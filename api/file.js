// GET /api/file?doc_id=<uuid>[&download=1]   — ADMIN ONLY (middleware gate)
// Redirects to a short-lived signed URL for the document's file.
import { getSupabase } from '../src/lib/supabase.js';
import { signedUrlFor } from '../src/lib/vault-files.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const { doc_id, download } = req.query;
  if (!doc_id) return res.status(400).json({ error: 'doc_id required' });
  const { data: row } = await getSupabase().from('document_vault')
    .select('id, storage_path, file_url').eq('id', doc_id).maybeSingle();
  if (!row) return res.status(404).json({ error: 'doc not found' });
  const s = await signedUrlFor(row, { download: download === '1' });
  if (s.error) return res.status(404).json({ error: s.error });
  res.setHeader('Cache-Control', 'private, no-store');
  res.writeHead(302, { Location: s.url });
  res.end();
}
