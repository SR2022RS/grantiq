import { getSupabase } from '../../lib/supabase.js';

export const saveGrantSchema = {
  name: 'save_grant',
  description: 'Insert or update a grant in the pipeline. Use after discovery to persist findings.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      name: { type: 'string' },
      agency: { type: 'string' },
      amount: { type: 'string' },
      deadline: { type: 'string', description: 'ISO date or null' },
      url: { type: 'string' },
      description: { type: 'string' },
      match_score: { type: 'number' },
      status: { type: 'string', description: 'new, reviewing, applied, rejected, etc.' },
    },
    required: ['org_id', 'name'],
  },
};

export async function saveGrant(input) {
  const supabase = getSupabase();
  const row = {
    org_id: input.org_id,
    name: input.name,
    agency: input.agency || '',
    amount: input.amount || '',
    deadline: input.deadline || null,
    url: input.url || '',
    description: input.description || '',
    match_score: input.match_score || null,
    status: input.status || 'new',
  };
  const { data, error } = await supabase
    .from('grant_opportunities')
    .upsert(row, { onConflict: 'org_id,name' })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, grant_id: data.id };
}
