// POST /api/upload/complete?t=<token>|org=<org_id>   body: { doc_id, path, mime_type }
// Confirms the file landed in storage and marks the checklist item uploaded.
// The previous file (if any) is kept in storage, never deleted here.
import { getSupabase } from '../../src/lib/supabase.js';
import { isAdmin } from '../../src/lib/session.js';
import { resolveOrg, normalizeMime, UPLOAD_BUCKET } from '../../src/lib/vault-files.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  res.setHeader('Cache-Control', 'private, no-store');
  const who = await resolveOrg({ token: req.query.t, org: req.query.org, admin: isAdmin(req) });
  if (who.error) return res.status(who.status).json({ error: who.error });

  const { doc_id, path, mime_type } = req.body || {};
  if (!doc_id || !path) return res.status(400).json({ error: 'doc_id and path required' });
  const prefix = `${who.orgId}/${doc_id}/`;
  if (!String(path).startsWith(prefix) || String(path).includes('..')) {
    return res.status(400).json({ error: 'path does not belong to this document' });
  }

  const supabase = getSupabase();
  const { data: doc } = await supabase.from('document_vault').select('id, org_id').eq('id', doc_id).maybeSingle();
  if (!doc || doc.org_id !== who.orgId) return res.status(404).json({ error: 'document not found' });

  const name = String(path).slice(prefix.length);
  const { data: listed, error: listErr } = await supabase.storage.from(UPLOAD_BUCKET)
    .list(prefix.slice(0, -1), { search: name, limit: 10 });
  if (listErr) return res.status(500).json({ error: 'could not verify upload' });
  const obj = (listed || []).find(o => o.name === name);
  if (!obj) return res.status(409).json({ error: 'upload not found in storage — please try again' });

  const now = new Date().toISOString();
  const { error } = await supabase.from('document_vault').update({
    status: 'uploaded',
    storage_path: path,
    file_url: path, // mirrors storage_path; signed URLs are generated on demand
    mime_type: normalizeMime(mime_type, name) || obj.metadata?.mimetype || null,
    size_bytes: obj.metadata?.size ?? null,
    uploaded_at: now,
    updated_at: now,
  }).eq('id', doc_id);
  if (error) return res.status(500).json({ error: 'could not update checklist' });
  return res.status(200).json({ ok: true });
}
