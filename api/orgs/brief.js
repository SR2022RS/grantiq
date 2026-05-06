// GET  /api/orgs/brief?org_id=<id>           — fetch the org's structured brief
// PUT  /api/orgs/brief    body: { org_id, brief }  — replace the brief blob
//
// "brief" is a JSONB blob stored under orgs.data.brief. Schema (free-form):
//   {
//     metrics:           [{ label, value, note }],
//     who_we_are:        string,
//     the_problem:       string,
//     our_solution:      string,
//     target_population: string[],
//     why_us:            [{ heading, body }],
//     funding_alignment: string[],
//     funding_request:   string,
//   }

import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  const supabase = getSupabase();

  if (req.method === 'GET') {
    const org_id = req.query.org_id;
    if (!org_id) return res.status(400).json({ error: 'org_id query param required' });
    const { data, error } = await supabase
      .from('orgs')
      .select('id, name, data')
      .eq('id', org_id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: `org "${org_id}" not found` });
    return res.status(200).json({
      ok: true,
      org_id,
      org_name: data.name,
      brief: data.data?.brief || {},
    });
  }

  if (req.method === 'PUT') {
    const { org_id, brief } = req.body || {};
    if (!org_id) return res.status(400).json({ error: 'org_id required' });
    if (!brief || typeof brief !== 'object') {
      return res.status(400).json({ error: 'brief object required' });
    }
    const { data: existing, error: getErr } = await supabase
      .from('orgs')
      .select('data')
      .eq('id', org_id)
      .maybeSingle();
    if (getErr) return res.status(500).json({ error: getErr.message });
    if (!existing) return res.status(404).json({ error: `org "${org_id}" not found` });

    const newData = { ...(existing.data || {}), brief };
    const { error: updErr } = await supabase
      .from('orgs')
      .update({ data: newData, updated_at: new Date().toISOString() })
      .eq('id', org_id);
    if (updErr) return res.status(500).json({ error: updErr.message });

    return res.status(200).json({ ok: true, org_id, brief });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
