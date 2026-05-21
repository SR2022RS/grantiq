// POST /api/leads/submit  — PUBLIC (must be excluded from the Basic Auth gate in
// middleware.js). Captures a sales-page lead into marketing_leads via the service
// role. Mirrors the Growth Engine submit-lead edge function: honeypot + per-IP
// rate limit + insert. No account is created — invite-only follow-up.
//
// Body: { full_name, agency_name?, email, phone?, message?, interest?, source?, website? }
//   website = hidden honeypot field (bots fill it → silently accepted, not stored)
// Response: { success: true } | { error }

import { getSupabase } from '../../src/lib/supabase.js';

// In-memory per-IP rate limit. Fluid Compute reuses instances, so this holds
// across requests on a warm instance — best-effort, not a hard guarantee.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const hits = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
  }

  const body = req.body || {};

  // Honeypot — bots fill hidden fields. Pretend success, store nothing.
  if (body.website) {
    return res.status(200).json({ success: true, message: "Thanks! We'll reach out shortly." });
  }

  const full_name = String(body.full_name || '').trim();
  const email = String(body.email || '').trim();
  if (!full_name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('marketing_leads').insert({
      full_name,
      email,
      agency_name: String(body.agency_name || '').trim() || null,
      phone: String(body.phone || '').trim() || null,
      message: String(body.message || '').trim() || null,
      interest: String(body.interest || '').trim() || null,
      source: String(body.source || 'grantiq-sales-page').slice(0, 100),
    });
    if (error) throw error;
    return res.status(200).json({ success: true, message: "Thanks! We'll reach out shortly to get you set up." });
  } catch (e) {
    console.error('[leads/submit]', e?.message || e);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
