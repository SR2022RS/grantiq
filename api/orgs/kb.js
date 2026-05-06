// /api/orgs/kb — knowledge base entries per org
//
// GET   ?org_id=<id>                     → list all entries (ordered newest first)
// POST  body: { org_id, kind, title, body?, url?, tags? }
//                                         → create note/link/file_summary entry
// DELETE ?id=<entry-id>                  → delete a single entry

import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const org_id = req.query.org_id;
    if (!org_id) return res.status(400).json({ error: 'org_id query param required' });
    const { data, error } = await supabase
      .from('org_kb')
      .select('*')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, entries: data || [] });
  }

  if (req.method === 'POST') {
    const { org_id, kind, title, body, url, tags, file_id } = req.body || {};
    if (!org_id || !kind || !title) {
      return res.status(400).json({ error: 'org_id, kind, title required' });
    }
    if (!['note', 'link', 'file_summary'].includes(kind)) {
      return res.status(400).json({ error: `kind must be one of: note, link, file_summary` });
    }
    const row = {
      org_id,
      kind,
      title: String(title).slice(0, 200),
      body: body || null,
      url: url || null,
      file_id: file_id || null,
      tags: Array.isArray(tags) ? tags : [],
    };
    const { data, error } = await supabase.from('org_kb').insert(row).select('*').single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, entry: data });
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id query param required' });
    const { error } = await supabase.from('org_kb').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
