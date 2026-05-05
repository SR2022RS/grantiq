import { runPlaywrightTask } from '../../src/agents/playwright/index.js';
import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { application_url, org_id, grant_id, draft_id, form_type, instructions } = req.body || {};
  if (!application_url || !org_id) {
    return res.status(400).json({ error: 'application_url and org_id required' });
  }

  const supabase = getSupabase();
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert({
      from_agent: 'user',
      to_agent: 'playwright',
      status: 'queued',
      payload: { application_url, org_id, grant_id, draft_id, form_type, instructions },
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Run inline (within 300s function budget). For longer sessions, the cron
  // /api/cron/process-tasks picks them up if they're still queued.
  res.status(202).json({ task_id: task.id, message: 'Playwright task queued; will start within 60s' });
  setTimeout(() => {
    runPlaywrightTask({ task }).catch((e) => console.error('[playwright/start] error:', e));
  }, 0);
}
