// POST /api/upload/sign?t=<token>|org=<org_id>&doc_id=&filename=&mime_type=&size=
// Returns a one-time signed upload URL for the private bucket, bound to a path
// under this org + document. The browser PUTs the file straight to storage
// (no 4.5 MB function body limit), then calls /api/upload/complete.
import { getSupabase } from '../../src/lib/supabase.js';
import { isAdmin } from '../../src/lib/session.js';
import { resolveOrg, normalizeMime, safeFilename, MAX_BYTES, UPLOAD_BUCKET } from '../../src/lib/vault-files.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  res.setHeader('Cache-Control', 'private, no-store');
  const { t, org, doc_id, filename, mime_type, size } = req.query;
  const who = await resolveOrg({ token: t, org, admin: isAdmin(req) });
  if (who.error) return res.status(who.status).json({ error: who.error });
  if (!doc_id || !filename) return res.status(400).json({ error: 'doc_id and filename required' });

  const mime = normalizeMime(mime_type, filename);
  if (!mime) return res.status(415).json({ error: 'That file type is not accepted. Use PDF, Word, Excel, or a photo.' });
  if (Number(size) > MAX_BYTES) return res.status(413).json({ error: 'File is over the 25 MB limit.' });

  const supabase = getSupabase();
  const { data: doc } = await supabase.from('document_vault').select('id, org_id')
    .eq('id', doc_id).maybeSingle();
  if (!doc || doc.org_id !== who.orgId) return res.status(404).json({ error: 'document not found' });

  const path = `${doc.org_id}/${doc.id}/${Date.now()}_${safeFilename(filename)}`;
  const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path);
  if (error) return res.status(500).json({ error: 'could not prepare upload' });
  return res.status(200).json({ ok: true, upload_url: data.signedUrl, path, mime_type: mime });
}
