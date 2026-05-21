// POST /api/leads/update  — ADMIN (stays behind the Basic Auth gate in middleware.js).
// Updates a lead's status via the service role.
//
// Body: { id, status }  status ∈ new | contacted | qualified | onboarded | closed
// Response: { ok: true, lead } | { ok: false, error }

import { getSupabase } from '../../src/lib/supabase.js';

const STATUSES = new Set(['new', 'contacted', 'qualified', 'onboarded', 'closed']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { id, status } = req.body || {};
  if (!id) return res.status(400).json({ ok: false, error: 'id required' });
  if (!STATUSES.has(status)) return res.status(400).json({ ok: false, error: 'invalid status' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('marketing_leads')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return res.status(200).json({ ok: true, lead: data });
  } catch (e) {
    console.error('[leads/update]', e?.message || e);
    return res.status(500).json({ ok: false, error: 'Failed to update lead.' });
  }
}
