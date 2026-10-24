// Node-side verification of the grantiq_session cookie (same format as
// middleware.js / api/auth/login.js). Used by routes that are reachable
// without the middleware gate (client upload routes) but grant extra powers
// when the caller is the logged-in admin.
import crypto from 'node:crypto';

export function readSessionToken(req) {
  const header = req.headers?.cookie || '';
  const hit = header.split(';').map(s => s.trim()).find(c => c.startsWith('grantiq_session='));
  return hit ? hit.slice('grantiq_session='.length) : null;
}

export function isAdmin(req) {
  if (process.env.PORTAL_AUTH_DISABLED === 'true') return true;
  const token = readSessionToken(req);
  const secret = process.env.SESSION_SECRET;
  if (!token || !secret) return false;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return false;
  const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const a = Buffer.from(expected), b = Buffer.from(sigB64);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
