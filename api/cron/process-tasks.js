// GET /api/cron/process-tasks
// Vercel cron — fires every minute. Drains the agent_tasks queue:
// claims one queued playwright task, runs it inline (fire-and-forget so the
// cron HTTP call returns within Vercel's tight cron budget).
//
// Auth: requires CRON_SECRET in Authorization header (set in Vercel env +
// vercel.json crons block; Vercel attaches it automatically).

import { getSupabase } from '../../src/lib/supabase.js';
import { runPlaywrightTask } from '../../src/agents/playwright/index.js';

export default async function handler(req, res) {
  // Vercel sets Authorization: Bearer <CRON_SECRET> on cron-triggered requests.
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const supabase = getSupabase();
  // Atomic claim: update one queued playwright row to 'claimed' + return it.
  // PostgREST doesn't expose SELECT FOR UPDATE, so we use update().select().
  const { data: claimed, error } = await supabase
    .from('agent_tasks')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('status', 'queued')
    .eq('to_agent', 'playwright')
    .order('created_at', { ascending: true })
    .limit(1)
    .select('*');

  if (error) return res.status(500).json({ error: error.message });
  if (!claimed || claimed.length === 0) {
    return res.status(200).json({ ok: true, claimed: 0 });
  }

  const task = claimed[0];

  // Respond immediately so the cron call doesn't block on the long-running
  // Playwright session. Fire-and-forget the task runner.
  res.status(200).json({ ok: true, claimed: 1, task_id: task.id });
  setTimeout(() => {
    runPlaywrightTask({ task }).catch((e) =>
      console.error('[cron/process-tasks] runPlaywrightTask error:', e)
    );
  }, 0);
}
