// Portal access gate. Public paths (landing, login, public APIs, cron) pass through.
// Everything else requires a valid signed session cookie set by /api/auth/login —
// HTML requests get redirected to /login?next=<path>, API requests get 401.
//
// Session cookie format (see api/auth/login.js):
//   grantiq_session=<base64url(payload)>.<base64url(HMAC-SHA256(payload, SESSION_SECRET))>
//   payload = { exp: <unix-seconds> }
//
// Env vars required: SESSION_SECRET (must match login.js). PORTAL_PASSWORD is read
// by login.js. To turn the whole gate off without redeploying: set PORTAL_AUTH_DISABLED=true.

import crypto from 'node:crypto';

const PUBLIC_PATHS = new Set([
  '/', '/index.html',
  '/login', '/login.html',
  '/landing', '/get-access',                                  // legacy redirects
  '/k1', '/k1-upload', '/k1-upload.html',                     // public client upload pages
  '/holigenix', '/holigenix-upload', '/holigenix-upload.html',
  '/index-legacy.html',
  '/api/auth/login', '/api/auth/logout',
  '/api/leads/submit',                                         // public sales-page submit
  '/api/health',
  '/favicon.ico', '/robots.txt',
]);
const PUBLIC_PREFIXES = ['/api/cron/', '/_vercel/'];

export const config = {
  matcher: '/((?!_vercel/|favicon\\.ico).*)',
};

export default function middleware(request) {
  if (process.env.PORTAL_AUTH_DISABLED === 'true') return;

  const url = new URL(request.url);
  const path = url.pathname;

  if (PUBLIC_PATHS.has(path)) return;
  if (PUBLIC_PREFIXES.some(p => path.startsWith(p))) return;

  // Gated — require a valid signed session cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const token = cookieHeader
    .split(';')
    .map(s => s.trim())
    .find(c => c.startsWith('grantiq_session='))
    ?.slice('grantiq_session='.length);

  if (token && verifySession(token)) return;

  // Not authed
  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'auth required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const next = encodeURIComponent(path + (url.search || ''));
  return Response.redirect(new URL(`/login?next=${next}`, request.url), 302);
}

function verifySession(token) {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return false;

    const expected = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
    const a = Buffer.from(expected);
    const b = Buffer.from(sigB64);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
