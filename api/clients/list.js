// GET /api/clients/list   — ADMIN ONLY (middleware gate)
// Every org with its checklist progress and its active client upload link.
import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  const supabase = getSupabase();
  const [{ data: orgs }, { data: links }, { data: vault }] = await Promise.all([
    supabase.from('orgs').select('id, name, created_at').order('created_at', { ascending: false }),
    supabase.from('upload_links').select('org_id, token, created_at').is('revoked_at', null).order('created_at', { ascending: false }),
    supabase.from('document_vault').select('org_id, status'),
  ]);
  const prog = {};
  for (const v of vault || []) {
    const p = (prog[v.org_id] ||= { uploaded: 0, total: 0 });
    p.total++; if (v.status === 'uploaded') p.uploaded++;
  }
  const linkBy = {};
  for (const l of links || []) if (!linkBy[l.org_id]) linkBy[l.org_id] = `/u/${l.token}`;
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({
    ok: true,
    clients: (orgs || []).map(o => ({ id: o.id, name: o.name, link: linkBy[o.id] || null, ...(prog[o.id] || { uploaded: 0, total: 0 }) })),
  });
}
