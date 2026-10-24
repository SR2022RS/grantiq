// POST /api/clients/clear-doc   — ADMIN ONLY (middleware gate)
// Body: { doc_id }
// Removes a wrong/test upload: deletes the file (new private uploads only)
// and sets the checklist item back to "missing". Legacy files in the old
// 'grant-documents' bucket are never deleted from here.
import { getSupabase } from '../../src/lib/supabase.js';
import { UPLOAD_BUCKET } from '../../src/lib/vault-files.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { doc_id } = req.body || {};
  if (!doc_id) return res.status(400).json({ error: 'doc_id required' });
  const supabase = getSupabase();
  const { data: doc } = await supabase.from('document_vault')
    .select('id, org_id, storage_path, file_url').eq('id', doc_id).maybeSingle();
  if (!doc) return res.status(404).json({ error: 'doc not found' });
  if (!doc.storage_path) return res.status(409).json({ error: 'only files uploaded through the new upload page can be removed here' });
  const { error: rmErr } = await supabase.storage.from(UPLOAD_BUCKET).remove([doc.storage_path]);
  if (rmErr) return res.status(500).json({ error: 'could not remove file' });
  const { error } = await supabase.from('document_vault').update({
    status: 'missing', storage_path: null, file_url: null, mime_type: null, size_bytes: null,
    uploaded_at: null, updated_at: new Date().toISOString(),
  }).eq('id', doc_id);
  if (error) return res.status(500).json({ error: 'could not update checklist' });
  return res.status(200).json({ ok: true });
}
