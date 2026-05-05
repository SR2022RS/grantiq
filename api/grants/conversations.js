import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const supabase = getSupabase();
  const userChatId = req.query.user_chat_id || 'rodney';
  const { data, error } = await supabase
    .from('grants_conversations')
    .select('id, started_at, last_message_at, channel')
    .eq('user_chat_id', userChatId)
    .order('last_message_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ conversations: data || [] });
}
