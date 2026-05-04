import { getSupabase } from './supabase.js';

export async function postAlert({ agentId, severity, message, link }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .insert({ agent_id: agentId, severity, message, link: link || null })
    .select('id')
    .single();
  if (error) throw new Error(`[alerts] post: ${error.message}`);
  return data.id;
}

export async function listUnreadAlerts(limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .select('id, agent_id, severity, message, link, created_at')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[alerts] list: ${error.message}`);
  return data || [];
}

export async function markAlertRead(id) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`[alerts] markRead: ${error.message}`);
}
