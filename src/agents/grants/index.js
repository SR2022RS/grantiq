import { createGrantIQClient } from '../../lib/anthropic-client.js';
import {
  loadOrCreateConversation,
  loadMessages,
  persistTurn,
  appendUserText,
} from '../../lib/memory.js';
import { loadPersona } from '../../lib/workspace.js';
import { loadProjectContext } from '../../lib/agent-context.js';
import { logAgentActivity } from '../../lib/audit.js';
import { GRANTS_TOOL_SCHEMAS, dispatch } from './dispatch.js';

const AGENT_NAME = 'grants';

function extractKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((w) => w.length >= 4)
    .slice(0, 10);
}

export async function runGrantsTurn({ userMessage, conversationId, userChatId }) {
  // Load or create conversation
  let conversation;
  let priorMessages;
  if (conversationId) {
    conversation = { id: conversationId };
    priorMessages = await loadMessages(AGENT_NAME, conversationId);
  } else {
    const r = await loadOrCreateConversation({ agentName: AGENT_NAME, userChatId });
    conversation = r.conversation;
    priorMessages = r.messages;
  }

  // Build system prompt: persona + live project context
  const persona = loadPersona('grants');
  const keywords = extractKeywords(userMessage);
  const projectContext = await loadProjectContext({ agentName: AGENT_NAME, queryKeywords: keywords });

  const system = [
    { type: 'text', text: persona, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: projectContext },
  ];

  // Append user message
  const messagesIn = appendUserText(priorMessages, userMessage);
  const priorCount = messagesIn.length - 1;  // we just appended one

  // Run the loop
  const client = createGrantIQClient({ dispatch });
  const result = await client.run({
    system,
    messages: messagesIn,
    tools: GRANTS_TOOL_SCHEMAS,
  });

  // Persist all new turns (user message + assistant response + any tool turns)
  await persistTurn({
    agentName: AGENT_NAME,
    conversationId: conversation.id,
    priorMessageCount: priorCount,
    messages: result.messages,
  });

  // Telemetry
  await logAgentActivity({
    agentId: AGENT_NAME,
    action: 'chat_turn',
    detail: result.status,
    metadata: result.telemetry,
  });

  return {
    conversation_id: conversation.id,
    text: result.text,
    status: result.status,
    telemetry: result.telemetry,
  };
}
