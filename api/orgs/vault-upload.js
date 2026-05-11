// POST /api/orgs/vault-upload — upload a file for a specific document_vault row.
// Body: raw bytes (multipart not needed — frontend sends the file directly).
// Query params: doc_id, filename, mime_type
//
// On success:
//   - File stored in Supabase Storage bucket 'vault-docs' at <org_id>/<doc_id>/<safe_filename>
//   - document_vault row updated: status='uploaded', file_url + storage_path + mime_type + size_bytes set
//   - If the row was previously uploaded, the prior storage_path is removed (so we don't orphan files)
//
// Response: { ok, doc: {...updated row} }

import { getSupabase } from '../../src/lib/supabase.js';

export const config = {
  api: { bodyParser: false },
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'text/markdown', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BYTES) throw new Error('file exceeds 25 MB limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { doc_id, filename, mime_type } = req.query;
  if (!doc_id || !filename || !mime_type) {
    return res.status(400).json({ error: 'doc_id, filename, mime_type query params required' });
  }
  if (!ALLOWED_MIME.has(mime_type)) {
    return res.status(415).json({ error: `mime_type "${mime_type}" not allowed`, allowed: [...ALLOWED_MIME] });
  }

  const supabase = getSupabase();

  // Look up the vault row so we know org_id, and so we can clean up an old upload if it was already populated
  const { data: doc, error: lookupErr } = await supabase
    .from('document_vault')
    .select('id, org_id, doc_name, storage_path')
    .eq('id', doc_id)
    .maybeSingle();
  if (lookupErr) return res.status(500).json({ error: 'vault lookup failed: ' + lookupErr.message });
  if (!doc) return res.status(404).json({ error: 'document_vault row not found for that doc_id' });

  let bytes;
  try {
    bytes = await readBody(req);
  } catch (e) {
    return res.status(413).json({ error: e.message });
  }
  if (bytes.length === 0) return res.status(400).json({ error: 'empty body' });

  const safeName = String(filename).replace(/[^\w.\- ]/g, '_').slice(0, 200);
  const storagePath = `${doc.org_id}/${doc.id}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase
    .storage
    .from('vault-docs')
    .upload(storagePath, bytes, { contentType: mime_type, upsert: false });
  if (upErr) return res.status(500).json({ error: 'storage upload failed: ' + upErr.message });

  const nowIso = new Date().toISOString();
  const { data: updated, error: dbErr } = await supabase
    .from('document_vault')
    .update({
      status: 'uploaded',
      storage_path: storagePath,
      file_url: storagePath,        // file_url mirrors storage_path; signed URL is generated on demand
      mime_type,
      size_bytes: bytes.length,
      uploaded_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', doc_id)
    .select('*')
    .single();
  if (dbErr) {
    await supabase.storage.from('vault-docs').remove([storagePath]); // rollback the upload
    return res.status(500).json({ error: 'db update failed: ' + dbErr.message });
  }

  // If there was a prior file in storage for this doc, remove it now that the update succeeded
  if (doc.storage_path && doc.storage_path !== storagePath) {
    await supabase.storage.from('vault-docs').remove([doc.storage_path]).catch(() => {});
  }

  return res.status(200).json({ ok: true, doc: updated });
}
