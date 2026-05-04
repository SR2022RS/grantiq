// =============================================================================
// GrantIQ — agent conversation memory (Supabase-backed)
// =============================================================================
// Adapted from scout-vercel/src/agent/memory.js. Per-agent table prefix:
//   <AGENT_NAME>_conversations, <AGENT_NAME>_messages

import { getSupabase } from './supabase.js';

function tables(agentName) {
  return {
    conv: `${agentName}_conversations`,
    msg: `${agentName}_messages`,
  };
}

export async function loadOrCreateConversation({
  agentName,
  channel = 'web',
  userChatId = null,
} = {}) {
  if (!agentName) throw new Error('[memory] agentName required');
  const supabase = getSupabase();
  const t = tables(agentName);

  if (userChatId) {
    const { data: convs, error } = await supabase
      .from(t.conv)
      .select('*')
      .eq('channel', channel)
      .eq('user_chat_id', userChatId)
      .order('last_message_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`[memory] loadConversation: ${error.message}`);
    if (convs && convs.length) {
      const conv = convs[0];
      const messages = await loadMessages(agentName, conv.id);
      return { conversation: conv, messages };
    }
  }

  const { data: created, error: createErr } = await supabase
    .from(t.conv)
    .insert({ channel, user_chat_id: userChatId })
    .select('*')
    .single();
  if (createErr) throw new Error(`[memory] createConversation: ${createErr.message}`);
  return { conversation: created, messages: [] };
}

export async function loadMessages(agentName, conversationId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(tables(agentName).msg)
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`[memory] loadMessages: ${error.message}`);
  return (data || []).map((row) => ({ role: row.role, content: row.content }));
}

export async function persistTurn({
  agentName,
  conversationId,
  priorMessageCount,
  messages,
}) {
  const supabase = getSupabase();
  const t = tables(agentName);
  const newOnes = messages.slice(priorMessageCount);
  if (newOnes.length === 0) return;

  const rows = newOnes.map((msg) => ({
    conversation_id: conversationId,
    role: msg.role,
    content: msg.content,
    tool_use_id: firstToolId(msg.content),
  }));

  const { error } = await supabase.from(t.msg).insert(rows);
  if (error) {
    console.error(`[memory] insert ${t.msg} failed:`, error.message);
    return;
  }

  await supabase
    .from(t.conv)
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

function firstToolId(content) {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block?.type === 'tool_use') return block.id || null;
    if (block?.type === 'tool_result') return block.tool_use_id || null;
  }
  return null;
}

export function appendUserText(priorMessages, text) {
  return [...priorMessages, { role: 'user', content: text }];
}
