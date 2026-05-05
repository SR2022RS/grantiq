import { getSupabase } from '../../lib/supabase.js';

export const listDeadlinesSchema = {
  name: 'list_deadlines',
  description: 'List grant deadlines within N days for an org.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      days: { type: 'number', description: 'Default 30' },
    },
    required: ['org_id'],
  },
};

export async function listDeadlines({ org_id, days = 30 }) {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() + days * 86400_000).toISOString();
  const { data, error } = await supabase
    .from('grant_opportunities')
    .select('id, name, agency, deadline, match_score, status')
    .eq('org_id', org_id)
    .not('deadline', 'is', null)
    .lte('deadline', cutoff)
    .not('status', 'in', '(expired,rejected,skipped)')
    .order('deadline', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, deadlines: data || [] };
}
