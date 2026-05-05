import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const supabase = getSupabase();
  const { id } = req.query;

  if (id) {
    const { data, error } = await supabase
      .from('playwright_sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  const { data, error } = await supabase
    .from('playwright_sessions')
    .select('id, application_url, form_type, status, current_step, started_at, gate_reason')
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ sessions: data || [] });
}
