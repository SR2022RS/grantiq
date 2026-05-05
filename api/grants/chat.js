import { runGrantsTurn } from '../../src/agents/grants/index.js';
import { assertRequiredEnv } from '../../src/lib/constants.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    assertRequiredEnv();
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }

  const { message, conversation_id, user_chat_id } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message (string) required' });
  }

  try {
    const result = await runGrantsTurn({
      userMessage: message,
      conversationId: conversation_id || null,
      userChatId: user_chat_id || 'rodney',
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error('[api/grants/chat] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
