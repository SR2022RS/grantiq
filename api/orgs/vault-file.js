// GET /api/orgs/vault-file?doc_id=<uuid>   — ADMIN ONLY (middleware gate)
// Returns a short-lived signed URL for the file backing this document_vault row.
// Works for new uploads (private 'vault-docs') and legacy ones ('grant-documents').
// Response: { ok, url, expires_in } | { ok: false, error }
import { getSupabase } from '../../src/lib/supabase.js';
import { signedUrlFor } from '../../src/lib/vault-files.js';

const SIGN_TTL_SECONDS = 10 * 60;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const { doc_id } = req.query;
  if (!doc_id) return res.status(400).json({ error: 'doc_id required' });

  const { data: doc, error } = await getSupabase()
    .from('document_vault')
    .select('id, storage_path, file_url, mime_type, doc_name')
    .eq('id', doc_id)
    .maybeSingle();
  if (error) return res.status(500).json({ error: 'lookup failed: ' + error.message });
  if (!doc) return res.status(404).json({ error: 'doc not found' });

  const s = await signedUrlFor(doc, { ttl: SIGN_TTL_SECONDS });
  if (s.error) return res.status(404).json({ error: s.error });
  return res.status(200).json({
    ok: true,
    url: s.url,
    filename: doc.doc_name,
    mime_type: doc.mime_type,
    expires_in: SIGN_TTL_SECONDS,
  });
}
