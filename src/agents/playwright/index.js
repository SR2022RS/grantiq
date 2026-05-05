import { createGrantIQClient } from '../../lib/anthropic-client.js';
import { loadPersona } from '../../lib/workspace.js';
import { logAgentActivity } from '../../lib/audit.js';
import { getSupabase } from '../../lib/supabase.js';
import { PLAYWRIGHT_TOOL_SCHEMAS, dispatch } from './dispatch.js';

const AGENT_NAME = 'playwright';

export async function runPlaywrightTask({ task }) {
  const supabase = getSupabase();
  await supabase
    .from('agent_tasks')
    .update({ status: 'in_progress', claimed_at: new Date().toISOString() })
    .eq('id', task.id);

  const persona = loadPersona('playwright');

  // Load notes tagged with the form_type or portal domain
  const tags = [];
  if (task.payload.form_type) tags.push(task.payload.form_type);
  try {
    const u = new URL(task.payload.application_url);
    tags.push(u.hostname);
  } catch (_) {}

  let notes = [];
  if (tags.length) {
    const { data } = await supabase
      .from('agent_notes')
      .select('note, tags, confidence')
      .or(tags.map((t) => `tags.cs.{${t}}`).join(','))
      .is('archived_at', null)
      .limit(20);
    notes = data || [];
  }

  const notesText = notes.length
    ? '\n\n## Layer 3 notes (from past runs on this portal/form-type)\n' +
      notes.map((n) => `- [${n.confidence}] ${n.note}`).join('\n')
    : '';

  const system = [
    { type: 'text', text: persona, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: notesText },
  ];

  const taskPrompt = `New Playwright task:

Application URL: ${task.payload.application_url}
Org: ${task.payload.org_id}
${task.payload.grant_id ? `Grant ID: ${task.payload.grant_id}` : ''}
${task.payload.draft_id ? `Draft ID: ${task.payload.draft_id}` : ''}
Form type: ${task.payload.form_type || 'other'}
${task.payload.instructions ? `Instructions: ${task.payload.instructions}` : ''}

Begin: call start_session, then navigate, then snapshot_page. Plan fields. Fill. Gate for human at every gate per your persona rules.`;

  const client = createGrantIQClient({ dispatch });
  const result = await client.run({
    system,
    messages: [{ role: 'user', content: taskPrompt }],
    tools: PLAYWRIGHT_TOOL_SCHEMAS,
  });

  const finalStatus = result.status === 'success' ? 'done' : (result.status === 'partial' ? 'failed' : 'failed');
  await supabase
    .from('agent_tasks')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      result: { text: result.text, telemetry: result.telemetry },
    })
    .eq('id', task.id);

  await logAgentActivity({
    agentId: AGENT_NAME,
    action: 'task_run',
    detail: result.status,
    metadata: { task_id: task.id, ...result.telemetry },
  });

  return result;
}
