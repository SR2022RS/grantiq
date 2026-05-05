// GET /api/cron/deadline-check
// Vercel cron — fires every 6 hours.
//
// Runs the Grants agent against each org's deadline list. The agent
// consults agent_context_v (Layer 2) which already includes upcoming
// deadlines, plus calls list_deadlines + check_documents per org.
// Agent decides whether to alert.

import { runGrantsTurn } from '../../src/agents/grants/index.js';

const ORGS = ['holigenix_healthcare', 'k1_management', 'owner_nonprofit'];

const PROMPT = (orgId) =>
  `Deadline check for ${orgId}.

Use list_deadlines(org_id="${orgId}", days=21) to get upcoming deadlines within the next 21 days.

For each deadline, call check_documents(org_id="${orgId}") to assess readiness.

Alert rules:
- severity='high' if match_score >= 80 AND readiness_percent >= 85 (ready to apply, urgent)
- severity='warning' if match_score >= 80 AND readiness_percent < 85 (good fit but missing docs)
- severity='warning' if deadline within 7 days regardless of match score
- silent if match_score < 60 (low priority — let user notice in Pipeline)

Be selective — do not alert on every deadline. Only the actionable ones.`;

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const results = [];
  for (const orgId of ORGS) {
    try {
      const result = await runGrantsTurn({
        userMessage: PROMPT(orgId),
        conversationId: null,
        userChatId: `cron-deadlines-${orgId}`,
      });
      results.push({
        org: orgId,
        ok: true,
        status: result.status,
        iterations: result.telemetry?.iterations,
        tools_called: result.telemetry?.tools_invoked?.length || 0,
      });
    } catch (e) {
      console.error(`[cron/deadline-check] ${orgId}:`, e);
      results.push({ org: orgId, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ ok: true, results });
}
