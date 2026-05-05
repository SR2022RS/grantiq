import { getSupabase } from '../../lib/supabase.js';

export const saveDraftSchema = {
  name: 'save_draft',
  description: 'Persist an application draft (narrative + budget). Returns draft_id.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
      narrative: { type: 'object' },
      budget: { type: 'object' },
      status: { type: 'string', description: 'draft, ready, submitted' },
    },
    required: ['grant_id', 'org_id'],
  },
};

export async function saveDraft({ grant_id, org_id, narrative, budget, status = 'draft' }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('application_drafts')
    .insert({
      grant_id, org_id,
      narrative: narrative || {},
      budget: budget || {},
      status,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, draft_id: data.id };
}
