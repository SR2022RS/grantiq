// GET /api/orgs/vault-file?doc_id=<uuid>
// Returns a short-lived signed URL for the file backing this document_vault row.
// Response: { ok, url, expires_in } | { ok: false, error }

import { getSupabase } from '../../src/lib/supabase.js';

const SIGN_TTL_SECONDS = 60 * 60; // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const { doc_id } = req.query;
  if (!doc_id) return res.status(400).json({ error: 'doc_id required' });

  const supabase = getSupabase();
  const { data: doc, error } = await supabase
    .from('document_vault')
    .select('id, storage_path, mime_type, doc_name')
    .eq('id', doc_id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'lookup failed: ' + error.message });
  if (!doc) return res.status(404).json({ error: 'doc not found' });
  if (!doc.storage_path) return res.status(404).json({ error: 'this doc has no uploaded file' });

  const { data, error: signErr } = await supabase
    .storage
    .from('vault-docs')
    .createSignedUrl(doc.storage_path, SIGN_TTL_SECONDS);
  if (signErr) return res.status(500).json({ error: 'sign failed: ' + signErr.message });

  return res.status(200).json({
    ok: true,
    url: data.signedUrl,
    filename: doc.doc_name,
    mime_type: doc.mime_type,
    expires_in: SIGN_TTL_SECONDS,
  });
}
