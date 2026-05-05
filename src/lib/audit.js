import { getSupabase } from './supabase.js';

export async function logAgentActivity({ agentId, action, detail, metadata = {} } = {}) {
  try {
    const supabase = getSupabase();
    await supabase.from('agent_activity_log').insert({
      agent_id: agentId,
      action,
      detail: detail || '',
      metadata,
    });
  } catch (e) {
    console.error('[audit] logAgentActivity failed:', e?.message || e);
  }
}
