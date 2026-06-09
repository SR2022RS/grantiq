// POST /api/auth/login  — PUBLIC (no gate).
// Body: { password, next? }
// On success: sets a signed session cookie (7-day expiry) and returns { ok, redirect }.
//
// Session cookie format: grantiq_session=<payloadB64>.<sigB64>
//   payload = { exp: <unix-seconds> }
//   sig     = HMAC-SHA256(payloadB64, SESSION_SECRET)
//
// Env vars required: PORTAL_PASSWORD, SESSION_SECRET (32+ random bytes).

import crypto from 'node:crypto';

const SESSION_DAYS = 7;
const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

// In-memory per-IP rate limit (best-effort across warm instances)
const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;
const hits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.resetAt) { hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS }); return false; }
  e.count++; return e.count > RATE_LIMIT;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many attempts. Please try again in a minute.' });

  const expected = process.env.PORTAL_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret) {
    console.error('[auth/login] PORTAL_PASSWORD or SESSION_SECRET not set');
    return res.status(500).json({ error: 'auth not configured' });
  }

  const { password, next } = req.body || {};
  if (typeof password !== 'string') return res.status(400).json({ error: 'password required' });

  // Constant-time comparison to avoid timing side-channels
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'incorrect password' });

  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payloadB64 = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const sigB64 = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const token = `${payloadB64}.${sigB64}`;

  res.setHeader('Set-Cookie', [
    `grantiq_session=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
  ].join('; '));

  const safeNext = typeof next === 'string' && /^\/[^/]/.test(next) ? next : '/portal';
  return res.status(200).json({ ok: true, redirect: safeNext });
}
