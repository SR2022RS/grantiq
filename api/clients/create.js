// POST /api/clients/create   — ADMIN ONLY (middleware gate)
// Body: { name } to create a new client org with the standard checklist + link,
//    or { org_id } to issue an upload link for an existing org (adds the
//    standard checklist only if the org has none yet).
// Response: { ok, org: {id,name}, link: '/u/<token>', created_docs }
import { getSupabase } from '../../src/lib/supabase.js';
import { getScaffoldRows } from '../../src/lib/scaffold-templates.js';
import { STANDARD_CHECKLIST, newToken } from '../../src/lib/vault-files.js';

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 34);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const body = req.body || {};
  const supabase = getSupabase();
  let org;

  if (body.org_id) {
    const { data } = await supabase.from('orgs').select('id, name').eq('id', body.org_id).maybeSingle();
    if (!data) return res.status(404).json({ error: 'org not found' });
    org = data;
  } else {
    const name = String(body.name || '').trim().slice(0, 120);
    if (!name) return res.status(400).json({ error: 'client name required' });
    let id = slugify(name) || 'client';
    for (let i = 2; ; i++) {
      const { data: exists } = await supabase.from('orgs').select('id').eq('id', id).maybeSingle();
      if (!exists) break;
      id = `${slugify(name).slice(0, 30)}_${i}`;
    }
    const now = new Date().toISOString();
    const { error } = await supabase.from('orgs').insert({
      id, name, data: { id, name, short: name, certs: [], created_via: 'new_client_link' }, updated_at: now,
    });
    if (error) return res.status(500).json({ error: 'could not create client: ' + error.message });
    await supabase.from('org_templates').upsert(getScaffoldRows(id), { onConflict: 'org_id,doc_type' });
    org = { id, name };
  }

  let created_docs = 0;
  const { count } = await supabase.from('document_vault').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
  if (!count) {
    const rows = STANDARD_CHECKLIST.map(([doc_type, required_for, doc_name, description]) => ({
      org_id: org.id, doc_type, required_for, doc_name, description, status: 'missing',
    }));
    const { error } = await supabase.from('document_vault').insert(rows);
    if (error) return res.status(500).json({ error: 'could not create checklist: ' + error.message });
    created_docs = rows.length;
  }

  const token = newToken();
  const { error: linkErr } = await supabase.from('upload_links').insert({ org_id: org.id, token, label: body.label || null });
  if (linkErr) return res.status(500).json({ error: 'could not create link: ' + linkErr.message });
  return res.status(200).json({ ok: true, org, link: `/u/${token}`, created_docs });
}
