// POST /api/grants/add — manually add a grant the user found.
// Inserts a grant_opportunities row with research_status='pending',
// then fires the Grants research agent in the background. The frontend
// polls (via the existing 30s data refresh) and the row's research_status
// transitions pending → running → complete (or failed).
//
// Body: { org_id, name, funder?, amount?, deadline?, url?, notes? }
// Response: { ok, grant_id }

import { getSupabase } from '../../src/lib/supabase.js';
import { researchGrant } from '../../src/agents/grants/research-grant.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { org_id, name, funder, amount, deadline, url, notes } = req.body || {};
  if (!org_id || !name) {
    return res.status(400).json({ error: 'org_id and name required' });
  }

  const supabase = getSupabase();

  // Confirm org exists (lightweight FK guard)
  const { data: org } = await supabase.from('orgs').select('id').eq('id', org_id).maybeSingle();
  if (!org) return res.status(404).json({ error: `org "${org_id}" not found` });

  const row = {
    org_id,
    name: String(name).slice(0, 300),
    funder: funder || null,
    amount: amount || null,
    deadline: deadline || null,
    description: notes || null,
    submitted_url: url || null,
    status: 'new',
    source: 'manual',
    research_status: url ? 'pending' : 'complete',  // no URL → nothing to research
    match_score: null,
  };

  const { data, error } = await supabase
    .from('grant_opportunities')
    .insert(row)
    .select('id')
    .single();
  if (error) return res.status(500).json({ error: 'insert failed: ' + error.message });

  // Fire-and-forget research if we have a URL to research
  if (url) {
    res.status(200).json({ ok: true, grant_id: data.id, research_status: 'pending' });
    setTimeout(() => {
      researchGrant({ grant_id: data.id }).catch((e) => {
        console.error('[grants/add] researchGrant error:', e.message);
      });
    }, 0);
    return;
  }

  return res.status(200).json({ ok: true, grant_id: data.id, research_status: 'complete' });
}
