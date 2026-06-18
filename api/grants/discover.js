// POST /api/grants/discover
// Body: { org_id?: string | "all" }
// Response: { ok, started: { org_ids: [...] }, message }
//
// Fire-and-forget discovery. The UI calls this from the "Run discovery"
// button; the function returns immediately while the Grants agent runs in
// the background for each org. The agent saves new grants to the pipeline
// via its `save_grant` tool. The frontend's 30-second live-data refresh
// surfaces new rows as they land.

import { waitUntil } from '@vercel/functions';
import { runGrantsTurn } from '../../src/agents/grants/index.js';
import { getSupabase } from '../../src/lib/supabase.js';

const DISCOVERY_PROMPT = (orgId) =>
  `On-demand discovery scan for ${orgId}.

Search the web for new grants matching this org's profile. Use the org's certifications, regions, NAICS codes, and mission as your search terms. Also try domain-scoped searches against the priority sources listed in your persona (Grants.gov, Instrumentl, GrantWatch, etc.).

Save promising grants to the pipeline with status='new' via save_grant. Score each via score_grant. Deadline extraction is mandatory — never save a grant with deadline=null unless the funder explicitly states "rolling."

Apply the geographic eligibility rules from your hard rules — do not save state-specific grants outside this org's operating geography.

If any new grant scores ≥80% match AND deadline ≤21 days AND documents are ≥85% ready, post a high-severity alert via alert_user.

Summarize at the end: how many new grants saved, average match score, top 3 by score.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { org_id } = req.body || {};

  let orgIds = [];
  if (!org_id || org_id === 'all') {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('orgs').select('id');
    if (error) return res.status(500).json({ error: 'failed to list orgs: ' + error.message });
    orgIds = (data || []).map((o) => o.id);
  } else {
    orgIds = [org_id];
  }

  if (orgIds.length === 0) {
    return res.status(404).json({ error: 'no orgs to scan' });
  }

  // Fire-and-forget: kick off each org's discovery turn in the background.
  // waitUntil() registers each promise with Vercel's function lifecycle so the
  // instance stays alive until the agent finishes — without this, Vercel kills
  // the work the moment res.status(202).json(...) returns below, even on Fluid
  // Compute. (Fluid Compute reuses instances ACROSS requests but doesn't extend
  // a single request's lifetime; waitUntil is the sanctioned way to do that.)
  for (const orgId of orgIds) {
    waitUntil(
      runGrantsTurn({
        userMessage: DISCOVERY_PROMPT(orgId),
        conversationId: null,
        userChatId: `ondemand-discovery-${orgId}-${Date.now()}`,
      })
        .then((result) => {
          console.log(`[discover] ${orgId} ok · iterations=${result?.telemetry?.iterations} · tools=${result?.telemetry?.tools_invoked?.length}`);
        })
        .catch((e) => {
          console.error(`[discover] ${orgId} failed:`, e.message);
        })
    );
  }

  return res.status(202).json({
    ok: true,
    started: { org_ids: orgIds },
    message: `Discovery running for ${orgIds.length} org${orgIds.length === 1 ? '' : 's'}. New grants will appear in the Pipeline within 30-90 seconds.`,
  });
}
