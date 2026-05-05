import { getSupabase } from '../../lib/supabase.js';

export const getOrgSchema = {
  name: 'get_org',
  description: 'Fetch full org profile by ID.',
  input_schema: { type: 'object', properties: { org_id: { type: 'string' } }, required: ['org_id'] },
};

export async function getOrg({ org_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('orgs').select('*').eq('id', org_id).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, org: data };
}
