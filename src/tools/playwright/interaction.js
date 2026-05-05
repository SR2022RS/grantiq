import { getSession } from '../../lib/browser.js';
import { getSupabase } from '../../lib/supabase.js';

export const fillFieldSchema = {
  name: 'fill_field',
  description: 'Type a value into an input field.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string', description: 'CSS or accessibility selector' },
      value: { type: 'string' },
    },
    required: ['session_id', 'selector', 'value'],
  },
};

export async function fillField({ session_id, selector, value }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.fill(selector, value, { timeout: 10_000 });
  return { ok: true };
}

export const clickSchema = {
  name: 'click',
  description: 'Click an element.',
  input_schema: {
    type: 'object',
    properties: { session_id: { type: 'string' }, selector: { type: 'string' } },
    required: ['session_id', 'selector'],
  },
};

export async function click({ session_id, selector }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.click(selector, { timeout: 10_000 });
  return { ok: true };
}

export const selectOptionSchema = {
  name: 'select_option',
  description: 'Choose an option from a select dropdown.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string' },
      value: { type: 'string' },
    },
    required: ['session_id', 'selector', 'value'],
  },
};

export async function selectOption({ session_id, selector, value }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.selectOption(selector, value);
  return { ok: true };
}

export const checkFieldSchema = {
  name: 'check_field',
  description: 'Verify a field\'s current value matches expected. Use after fill_field for critical fields.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string' },
      expected_value: { type: 'string' },
    },
    required: ['session_id', 'selector', 'expected_value'],
  },
};

export async function checkField({ session_id, selector, expected_value }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  const actual = await s.page.inputValue(selector);
  return { ok: actual === expected_value, actual, expected: expected_value };
}

export const uploadFileSchema = {
  name: 'upload_file',
  description: 'Upload a document from the document_vault into a file input.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string' },
      doc_id: { type: 'string' },
    },
    required: ['session_id', 'selector', 'doc_id'],
  },
};

export async function uploadFile({ session_id, selector, doc_id }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  const supabase = getSupabase();
  const { data: doc, error } = await supabase
    .from('document_vault')
    .select('doc_name, file_url')
    .eq('id', doc_id)
    .single();
  if (error || !doc?.file_url) return { ok: false, error: 'doc not found or no URL' };

  const fileRes = await fetch(doc.file_url);
  if (!fileRes.ok) return { ok: false, error: `download failed: ${fileRes.status}` };
  const buf = Buffer.from(await fileRes.arrayBuffer());
  await s.page.setInputFiles(selector, {
    name: doc.doc_name + '.pdf',
    mimeType: 'application/pdf',
    buffer: buf,
  });
  return { ok: true };
}
