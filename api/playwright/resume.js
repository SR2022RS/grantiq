import { getSupabase } from '../../src/lib/supabase.js';
import { runPlaywrightTask } from '../../src/agents/playwright/index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { session_id, user_action } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const supabase = getSupabase();
  const { data: session, error: sErr } = await supabase
    .from('playwright_sessions')
    .select('*')
    .eq('id', session_id)
    .single();
  if (sErr || !session) return res.status(404).json({ error: 'session not found' });
  if (session.status !== 'gated') return res.status(409).json({ error: `session is ${session.status}, not gated` });

  await supabase
    .from('playwright_sessions')
    .update({ status: 'in_progress', gate_reason: null })
    .eq('id', session_id);

  // Find the originating task
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('*')
    .contains('payload', { application_url: session.application_url })
    .eq('to_agent', 'playwright')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Re-invoke with a resume note in instructions
  const resumeTask = {
    ...task,
    payload: {
      ...task.payload,
      instructions: `${task.payload.instructions || ''}\n\nRESUMING from gate. User action: ${user_action || 'approved'}. Continue from where you stopped.`,
    },
  };

  res.status(202).json({ session_id, message: 'Resuming session' });
  setTimeout(() => {
    runPlaywrightTask({ task: resumeTask }).catch((e) => console.error('[playwright/resume] error:', e));
  }, 0);
}
