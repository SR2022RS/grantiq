import { getSupabase } from '../../lib/supabase.js';

export const queryPipelineSchema = {
  name: 'query_pipeline',
  description: 'Read existing grants from the pipeline. Filter by org, status, min match score, deadline window.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      status: { type: 'string', description: 'Filter by status (new, reviewing, etc.)' },
      min_match: { type: 'number' },
      deadline_within_days: { type: 'number' },
      limit: { type: 'number' },
    },
  },
};

export async function queryPipeline({ org_id, status, min_match, deadline_within_days, limit = 25 }) {
  const supabase = getSupabase();
  let q = supabase
    .from('grant_opportunities')
    .select('id, name, funder, amount, deadline, match_score, status, url, created_at')
    .order('match_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (org_id) q = q.eq('org_id', org_id);
  if (status) q = q.eq('status', status);
  if (min_match) q = q.gte('match_score', min_match);
  if (deadline_within_days) {
    const cutoff = new Date(Date.now() + deadline_within_days * 86400_000).toISOString();
    q = q.lte('deadline', cutoff);
  }
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, grants: data || [] };
}
