// /api/orgs/kb-files — list and signed-URL helpers for KB files.
//
// GET   ?org_id=<id>          → list all files for an org with signed download URLs
// GET   ?file_id=<id>         → get one file with signed download URL
// DELETE ?file_id=<id>        → delete file from storage + DB row

import { getSupabase } from '../../src/lib/supabase.js';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

async function signOne(supabase, row) {
  const { data, error } = await supabase
    .storage
    .from('org-kb')
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  return { ...row, signed_url: error ? null : data?.signedUrl || null };
}

export default async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    if (req.query.file_id) {
      const { data, error } = await supabase
        .from('org_kb_files')
        .select('*')
        .eq('id', req.query.file_id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ ok: true, file: await signOne(supabase, data) });
    }

    const org_id = req.query.org_id;
    if (!org_id) return res.status(400).json({ error: 'org_id or file_id required' });
    const { data, error } = await supabase
      .from('org_kb_files')
      .select('*')
      .eq('org_id', org_id)
      .order('uploaded_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const files = await Promise.all((data || []).map((row) => signOne(supabase, row)));
    return res.status(200).json({ ok: true, files });
  }

  if (req.method === 'DELETE') {
    const file_id = req.query.file_id;
    if (!file_id) return res.status(400).json({ error: 'file_id required' });
    const { data: row, error: getErr } = await supabase
      .from('org_kb_files')
      .select('*')
      .eq('id', file_id)
      .maybeSingle();
    if (getErr) return res.status(500).json({ error: getErr.message });
    if (!row) return res.status(404).json({ error: 'not found' });

    await supabase.storage.from('org-kb').remove([row.storage_path]);
    const { error: delErr } = await supabase.from('org_kb_files').delete().eq('id', file_id);
    if (delErr) return res.status(500).json({ error: delErr.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
