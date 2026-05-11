// GET /api/cron/daily-discovery
// Vercel cron — fires daily at 12:00 UTC (7am ET).
//
// Runs the Grants agent in Discovery mode for each org. The agent's
// per-org system prompt knows the geographic eligibility envelope
// (workspace/grants.md), so Holigenix won't get DE/PA/NJ grants etc.
//
// The agent decides which tools to use; this endpoint just kicks it off.

import { runGrantsTurn } from '../../src/agents/grants/index.js';
import { getSupabase } from '../../src/lib/supabase.js';

const DISCOVERY_PROMPT = (orgId) =>
  `Daily discovery scan for ${orgId}.

Search the web for new grants matching this org's profile. Use the org's certifications, regions, NAICS codes, and mission as your search terms. Save promising ones to the pipeline with status='new' via save_grant. Score each via score_grant.

Apply the geographic eligibility rules from your hard rules — do not save state-specific grants outside the org's operating geography.

If any new grant scores ≥80% match AND deadline ≤21 days AND documents are ≥85% ready, post a high-severity alert via alert_user.

Summarize at the end: how many new grants saved, average match score, top 3 by score.`;

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Read live org list from DB so any org added via the portal (e.g.,
  // AI Junkies University) gets included in nightly discovery automatically.
  const supabase = getSupabase();
  const { data: orgRows, error: orgErr } = await supabase.from('orgs').select('id');
  if (orgErr) return res.status(500).json({ error: 'failed to list orgs: ' + orgErr.message });
  const orgIds = (orgRows || []).map((o) => o.id);

  const results = [];
  for (const orgId of orgIds) {
    try {
      const result = await runGrantsTurn({
        userMessage: DISCOVERY_PROMPT(orgId),
        conversationId: null,           // fresh thread each cron run
        userChatId: `cron-discovery-${orgId}`,
      });
      results.push({
        org: orgId,
        ok: true,
        status: result.status,
        iterations: result.telemetry?.iterations,
        tokens: (result.telemetry?.tokens_in || 0) + (result.telemetry?.tokens_out || 0),
        tools_called: result.telemetry?.tools_invoked?.length || 0,
      });
    } catch (e) {
      console.error(`[cron/daily-discovery] ${orgId}:`, e);
      results.push({ org: orgId, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ ok: true, results });
}
