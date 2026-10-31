// GET /api/cron/daily-discovery            (Vercel cron, daily 12:00 UTC / 7am ET)
// GET /api/cron/daily-discovery?org=<id>   (one org; called by the fan-out)
//
// Runs the Grants agent in Discovery mode for each org. The agent's
// per-org system prompt knows the geographic eligibility envelope
// (workspace/grants.md), so Holigenix won't get DE/PA/NJ grants etc.
//
// Why the fan-out: one agent turn takes ~40-180 s, so looping every org inside
// a single invocation always hit the function time limit after the first org.
// Now the cron call only lists the orgs and starts one invocation per org
// (each with its own time budget, see vercel.json maxDuration). Each org run
// logs one row to grant_runs (status, grants found, telemetry).

import { waitUntil } from '@vercel/functions';
import { runGrantsTurn } from '../../src/agents/grants/index.js';
import { getSupabase } from '../../src/lib/supabase.js';

const DISCOVERY_MAX_ITERATIONS = parseInt(process.env.GRANTIQ_DISCOVERY_MAX_ITERATIONS || '20', 10);

const DISCOVERY_PROMPT = (orgId) =>
  `Daily discovery scan for ${orgId}.

Search the web for new grants matching this org's profile. Use the org's certifications, regions, NAICS codes, and mission as your search terms. Save promising ones to the pipeline with status='new' via save_grant. Score each via score_grant.

Work budget (this run has a hard time limit): do at most 2 rounds of web_search, open only the most promising pages (about 8), and call save_grant for each confirmed fit as soon as you have its funder, deadline and eligibility, before researching the next one. Skip grants that are already in the pipeline. Saving real matches matters more than exhaustive research.

Apply the geographic eligibility rules from your hard rules — do not save state-specific grants outside the org's operating geography.

If any new grant scores ≥80% match AND deadline ≤21 days AND documents are ≥85% ready, post a high-severity alert via alert_user.

Summarize at the end: how many new grants saved, average match score, top 3 by score.`;

async function logRun(supabase, row) {
  try {
    const { error } = await supabase.from('grant_runs').insert(row);
    if (error) console.error('[cron/daily-discovery] grant_runs insert:', error.message);
  } catch (e) {
    console.error('[cron/daily-discovery] grant_runs insert threw:', e?.message || e);
  }
}

// Run discovery for one org and record the outcome in grant_runs.
export async function runOrgDiscovery(orgId) {
  const supabase = getSupabase();
  const startedAt = new Date();
  let status = 'failed';
  let metadata = {};
  try {
    const result = await runGrantsTurn({
      userMessage: DISCOVERY_PROMPT(orgId),
      conversationId: null,
      // one fresh thread per run, so history doesn't pile up run after run
      userChatId: `cron-discovery-${orgId}-${startedAt.toISOString()}`,
      maxIterations: DISCOVERY_MAX_ITERATIONS,
      wrapUp: {
        atIteration: Math.max(1, DISCOVERY_MAX_ITERATIONS - 5),
        text: 'Time is almost up. Stop searching and fetching now. Call save_grant (then score_grant) for every qualifying grant you found that is not already in the pipeline, then give the summary.',
      },
    });
    status = result.status === 'success' ? 'completed' : (result.status || 'partial');
    metadata = {
      source: 'daily-discovery',
      iterations: result.telemetry?.iterations,
      tokens: (result.telemetry?.tokens_in || 0) + (result.telemetry?.tokens_out || 0),
      tools_called: result.telemetry?.tools_invoked?.length || 0,
      latency_ms: result.telemetry?.latency_ms,
      summary: (result.text || '').slice(0, 2000),
    };
  } catch (e) {
    console.error(`[cron/daily-discovery] ${orgId}:`, e);
    metadata = { source: 'daily-discovery', error: String(e?.message || e).slice(0, 1000) };
  }

  let grantsFound = 0;
  try {
    const { count } = await supabase
      .from('grant_opportunities')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', startedAt.toISOString());
    grantsFound = count || 0;
  } catch (_) { /* count is best-effort */ }

  metadata.duration_ms = Date.now() - startedAt.getTime();
  await logRun(supabase, {
    org_id: orgId,
    run_date: startedAt.toISOString(),
    grants_found: grantsFound,
    status,
    metadata,
    created_by: 'daily-discovery',
  });
  console.log(`[cron/daily-discovery] ${orgId} ${status} · new grants=${grantsFound} · ${metadata.duration_ms} ms`);
  return { org: orgId, status, grants_found: grantsFound };
}

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Single-org mode: answer right away, keep the instance alive for the run.
  const one = typeof req.query?.org === 'string' ? req.query.org.trim() : '';
  if (one) {
    waitUntil(runOrgDiscovery(one).catch((e) => console.error(`[cron/daily-discovery] ${one}:`, e)));
    return res.status(202).json({ ok: true, started: one });
  }

  // Fan-out mode (the daily cron). Read the live org list so any org added via
  // the portal gets included automatically.
  const supabase = getSupabase();
  const { data: orgRows, error: orgErr } = await supabase.from('orgs').select('id');
  if (orgErr) return res.status(500).json({ error: 'failed to list orgs: ' + orgErr.message });
  const orgIds = (orgRows || []).map((o) => o.id);

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const base = `https://${host}/api/cron/daily-discovery`;
  const started = await Promise.all(
    orgIds.map(async (orgId) => {
      try {
        const r = await fetch(`${base}?org=${encodeURIComponent(orgId)}`, {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
          signal: AbortSignal.timeout(20_000),
        });
        return { org: orgId, ok: r.status === 202, status: r.status };
      } catch (e) {
        return { org: orgId, ok: false, error: String(e?.message || e) };
      }
    })
  );

  const failed = started.filter((s) => !s.ok);
  if (failed.length) console.error('[cron/daily-discovery] could not start:', JSON.stringify(failed));
  return res.status(200).json({ ok: failed.length === 0, started });
}
