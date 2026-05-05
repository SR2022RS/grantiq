import { getSupabase } from '../../lib/supabase.js';
import { getSession, takeScreenshot, snapshotAccessibilityTree } from '../../lib/browser.js';

async function uploadScreenshot(session_id, buf) {
  const supabase = getSupabase();
  const path = `${session_id}/${Date.now()}.png`;
  const { error: upErr } = await supabase
    .storage
    .from('playwright-screenshots')
    .upload(path, buf, { contentType: 'image/png', upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { data } = supabase.storage.from('playwright-screenshots').getPublicUrl(path);
  return data.publicUrl;
}

export const navigateSchema = {
  name: 'navigate',
  description: 'Navigate to a URL in the current session.',
  input_schema: {
    type: 'object',
    properties: { session_id: { type: 'string' }, url: { type: 'string' } },
    required: ['session_id', 'url'],
  },
};

export async function navigate({ session_id, url }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  return { ok: true, current_url: s.page.url() };
}

export const screenshotSchema = {
  name: 'screenshot',
  description: 'Capture the current page. Returns the public URL.',
  input_schema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] },
};

export async function screenshot({ session_id }) {
  const buf = await takeScreenshot({ session_id });
  const url = await uploadScreenshot(session_id, buf);

  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('playwright_sessions')
    .select('screenshots')
    .eq('id', session_id)
    .single();
  const arr = Array.isArray(row?.screenshots) ? row.screenshots : [];
  arr.push({ url, taken_at: new Date().toISOString() });
  await supabase.from('playwright_sessions').update({ screenshots: arr }).eq('id', session_id);

  return { ok: true, screenshot_url: url };
}

export const snapshotPageSchema = {
  name: 'snapshot_page',
  description: 'Get the accessibility tree of the current page (DOM-as-text for reasoning).',
  input_schema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] },
};

export async function snapshotPage({ session_id }) {
  const tree = await snapshotAccessibilityTree({ session_id });
  return { ok: true, tree };
}
