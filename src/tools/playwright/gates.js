import { getSupabase } from '../../lib/supabase.js';
import { postAlert } from '../../lib/alerts.js';

export const gateForHumanSchema = {
  name: 'gate_for_human',
  description: 'STOP execution and wait for human intervention. Use for signatures, CAPTCHAs, certifications, unexpected fields, or anything you\'re uncertain about.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      reason: { type: 'string', description: 'Why human input is needed' },
      screenshot_url: { type: 'string' },
    },
    required: ['session_id', 'reason'],
  },
};

export async function gateForHuman({ session_id, reason, screenshot_url }) {
  const supabase = getSupabase();
  const alertId = await postAlert({
    agentId: 'playwright',
    severity: 'high',
    message: `Playwright session paused: ${reason}`,
    link: `/sessions.html?id=${session_id}`,
  });
  await supabase
    .from('playwright_sessions')
    .update({
      status: 'gated',
      gate_reason: reason,
      gate_screenshot_url: screenshot_url || null,
    })
    .eq('id', session_id);
  return { ok: true, gated: true, alert_id: alertId, message: 'Session gated. Awaiting user resume.' };
}

export const submitFormSchema = {
  name: 'submit_form',
  description: 'Final form submission. ALWAYS gates for human approval before clicking. Never auto-submits.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      submit_selector: { type: 'string', description: 'CSS selector of submit button' },
      summary: { type: 'string', description: 'One-paragraph summary of what will be submitted' },
    },
    required: ['session_id', 'submit_selector', 'summary'],
  },
};

export async function submitForm({ session_id, submit_selector, summary }) {
  // submit_form ALWAYS gates per spec design decision Option A.
  return gateForHuman({
    session_id,
    reason: `READY TO SUBMIT. ${summary}\n\nReview screenshot. Click "Approve Submit" to fire selector: ${submit_selector}`,
  });
}
