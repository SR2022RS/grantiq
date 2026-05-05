import { getSupabase } from '../../lib/supabase.js';

export const searchPastDraftsSchema = {
  name: 'search_past_drafts',
  description: 'Search previous application drafts for similar grants or voice/tone references. Returns matching drafts with metadata.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Substring match against narrative content + grant name' },
      org_id: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
};

export async function searchPastDrafts({ query, org_id, limit = 5 }) {
  const supabase = getSupabase();
  let q = supabase
    .from('application_drafts')
    .select('id, grant_id, status, narrative, created_at, grant_opportunities(name, agency)')
    .order('created_at', { ascending: false })
    .limit(limit * 4);
  if (org_id) q = q.eq('org_id', org_id);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const lower = query.toLowerCase();
  const filtered = (data || [])
    .filter((d) => {
      const narrText = JSON.stringify(d.narrative || {}).toLowerCase();
      const grantName = (d.grant_opportunities?.name || '').toLowerCase();
      return narrText.includes(lower) || grantName.includes(lower);
    })
    .slice(0, limit);

  return { ok: true, drafts: filtered };
}
