import { getSupabase } from '../../lib/supabase.js';

export const getDraftSchema = {
  name: 'get_draft',
  description: 'Fetch a saved application draft by ID.',
  input_schema: { type: 'object', properties: { draft_id: { type: 'string' } }, required: ['draft_id'] },
};

export async function getDraft({ draft_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('application_drafts').select('*').eq('id', draft_id).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, draft: data };
}
