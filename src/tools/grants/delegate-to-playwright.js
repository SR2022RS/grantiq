import { getSupabase } from '../../lib/supabase.js';

export const delegateToPlaywrightSchema = {
  name: 'delegate_to_playwright',
  description: 'Hand off form-filling to the Playwright agent. Creates an agent_tasks row; Playwright picks it up via cron.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      draft_id: { type: 'string' },
      application_url: { type: 'string' },
      org_id: { type: 'string' },
      form_type: { type: 'string', description: 'grant, vendor_onboarding, cert_renewal, rfp, costars, sam_gov, other' },
      instructions: { type: 'string', description: 'Optional special instructions' },
    },
    required: ['application_url', 'org_id'],
  },
};

export async function delegateToPlaywright(payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      from_agent: 'grants',
      to_agent: 'playwright',
      status: 'queued',
      payload,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, task_id: data.id, message: 'Handed to Playwright. Cron will pick up within 60 seconds; alert will fire when session starts and on first gate.' };
}
