// GET /api/upload/checklist?t=<link token>      — public client view
// GET /api/upload/checklist?org=<org_id>         — admin view (login required)
// Returns the org's checklist status only. No file URLs, no draft content.
import { getSupabase } from '../../src/lib/supabase.js';
import { isAdmin } from '../../src/lib/session.js';
import { resolveOrg, fileNameOf } from '../../src/lib/vault-files.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  res.setHeader('Cache-Control', 'private, no-store');
  const admin = isAdmin(req);
  const who = await resolveOrg({ token: req.query.t, org: req.query.org, admin });
  if (who.error) return res.status(who.status).json({ error: who.error });

  const supabase = getSupabase();
  const [{ data: org }, { data: rows, error }] = await Promise.all([
    supabase.from('orgs').select('id, name').eq('id', who.orgId).maybeSingle(),
    supabase.from('document_vault')
      .select('id, doc_name, description, required_for, status, uploaded_at, storage_path, file_url')
      .eq('org_id', who.orgId).order('required_for').order('doc_name'),
  ]);
  if (error) return res.status(500).json({ error: 'checklist lookup failed' });
  if (!org) return res.status(404).json({ error: 'organization not found' });

  let link = null;
  if (admin) {
    const { data: l } = await supabase.from('upload_links').select('token')
      .eq('org_id', who.orgId).is('revoked_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (l) link = `/u/${l.token}`;
  }

  const docs = (rows || []).map(r => {
    const d = {
      id: r.id, doc_name: r.doc_name, description: r.description || '',
      required_for: r.required_for || 'all', status: r.status, uploaded_at: r.uploaded_at,
      has_file: !!(r.storage_path || r.file_url),
    };
    if (admin) d.file_name = fileNameOf(r);
    return d;
  });
  return res.status(200).json({ ok: true, admin, org: { id: org.id, name: org.name }, link, docs });
}
