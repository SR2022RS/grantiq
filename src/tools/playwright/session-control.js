import { getSupabase } from '../../lib/supabase.js';
import { startBrowser, endBrowser } from '../../lib/browser.js';

export const startSessionSchema = {
  name: 'start_session',
  description: 'Spawn a browser session for form filling. Creates a playwright_sessions row.',
  input_schema: {
    type: 'object',
    properties: {
      application_url: { type: 'string' },
      org_id: { type: 'string' },
      grant_id: { type: 'string' },
      draft_id: { type: 'string' },
      form_type: { type: 'string' },
    },
    required: ['application_url', 'org_id'],
  },
};

export async function startSession(input) {
  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from('playwright_sessions')
    .insert({
      application_url: input.application_url,
      org_id: input.org_id,
      grant_id: input.grant_id || null,
      draft_id: input.draft_id || null,
      form_type: input.form_type || 'other',
      status: 'starting',
      state_json: {},
      screenshots: [],
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  try {
    await startBrowser({ session_id: row.id });
    await supabase
      .from('playwright_sessions')
      .update({ status: 'in_progress' })
      .eq('id', row.id);
    return { ok: true, session_id: row.id };
  } catch (e) {
    await supabase
      .from('playwright_sessions')
      .update({ status: 'failed', result: { error: e.message } })
      .eq('id', row.id);
    return { ok: false, error: e.message };
  }
}

export const saveProgressSchema = {
  name: 'save_progress',
  description: 'Checkpoint current session state. Call every 3 fields filled.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      current_step: { type: 'number' },
      state_update: { type: 'object', description: 'Fields filled so far this turn' },
    },
    required: ['session_id', 'current_step'],
  },
};

export async function saveProgress({ session_id, current_step, state_update }) {
  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('playwright_sessions')
    .select('state_json')
    .eq('id', session_id)
    .single();
  const merged = { ...(row?.state_json || {}), ...(state_update || {}) };
  const { error } = await supabase
    .from('playwright_sessions')
    .update({ state_json: merged, current_step })
    .eq('id', session_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export const endSessionSchema = {
  name: 'end_session',
  description: 'Close the browser. Call after submit or cancel.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      status: { type: 'string', enum: ['completed', 'failed', 'cancelled'] },
      result: { type: 'object' },
    },
    required: ['session_id', 'status'],
  },
};

export async function endSession({ session_id, status, result }) {
  const supabase = getSupabase();
  await endBrowser(session_id);
  const { error } = await supabase
    .from('playwright_sessions')
    .update({ status, result: result || {}, ended_at: new Date().toISOString() })
    .eq('id', session_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
