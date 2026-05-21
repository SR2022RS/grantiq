// GET /api/leads/list  — ADMIN (stays behind the Basic Auth gate in middleware.js).
// Returns marketing_leads newest-first via the service role. The browser anon key
// cannot read this table (RLS enabled, no policies), so reads must come through here.
//
// Response: { ok: true, leads: [...] }

import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('marketing_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    return res.status(200).json({ ok: true, leads: data || [] });
  } catch (e) {
    console.error('[leads/list]', e?.message || e);
    return res.status(500).json({ ok: false, error: 'Failed to load leads.' });
  }
}
