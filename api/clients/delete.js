// POST /api/clients/delete   — ADMIN ONLY (middleware gate)
// Body: { org_id, confirm: <org_id> }
// Removes a client created with "New client" (its files, checklist, links, org).
// Refuses any org that was not created through the New-client flow, so
// established orgs (Holigenix, K1, ...) can never be removed from here.
import { getSupabase } from '../../src/lib/supabase.js';
import { UPLOAD_BUCKET } from '../../src/lib/vault-files.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { org_id, confirm } = req.body || {};
  if (!org_id || confirm !== org_id) return res.status(400).json({ error: 'org_id and matching confirm required' });
  const supabase = getSupabase();
  const { data: org } = await supabase.from('orgs').select('id, data').eq('id', org_id).maybeSingle();
  if (!org) return res.status(404).json({ error: 'org not found' });
  if (org.data?.created_via !== 'new_client_link') {
    return res.status(403).json({ error: 'only clients created with "New client" can be deleted here' });
  }
  const { data: rows } = await supabase.from('document_vault').select('storage_path').eq('org_id', org_id);
  const paths = (rows || []).map(r => r.storage_path).filter(p => p && p.startsWith(org_id + '/'));
  let removed = 0;
  if (paths.length) {
    const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).remove(paths);
    if (error) return res.status(500).json({ error: 'could not remove files' });
    removed = (data || []).length;
  }
  await supabase.from('upload_links').delete().eq('org_id', org_id);
  await supabase.from('document_vault').delete().eq('org_id', org_id);
  await supabase.from('org_templates').delete().eq('org_id', org_id);
  const { error } = await supabase.from('orgs').delete().eq('id', org_id);
  if (error) return res.status(500).json({ error: 'could not delete org: ' + error.message });
  return res.status(200).json({ ok: true, deleted: org_id, files_removed: removed });
}
