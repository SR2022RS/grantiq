import { getSupabase } from '../../lib/supabase.js';

export const getGrantSchema = {
  name: 'get_grant',
  description: 'Fetch full grant details by ID.',
  input_schema: { type: 'object', properties: { grant_id: { type: 'string' } }, required: ['grant_id'] },
};

export async function getGrant({ grant_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('grant_opportunities').select('*').eq('id', grant_id).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, grant: data };
}
