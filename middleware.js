// Portal access gate. Public paths (landing, login, public APIs, cron) pass through.
// Everything else requires a valid signed session cookie set by /api/auth/login —
// HTML requests get redirected to /login?next=<path>, API requests get 401.
//
// Session cookie format (see api/auth/login.js):
//   grantiq_session=<base64url(payload)>.<base64url(HMAC-SHA256(payload, SESSION_SECRET))>
//   payload = { exp: <unix-seconds> }
//
// Edge runtime: uses Web Crypto (globalThis.crypto.subtle). The login endpoint
// itself runs as a Node function and can use node:crypto freely. The signatures
// produced/verified are identical bytes either way.
//
// Env vars required: SESSION_SECRET (must match login.js). PORTAL_PASSWORD is
// read by login.js. To turn the whole gate off without redeploying: set
// PORTAL_AUTH_DISABLED=true.

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

export default async function middleware(request) {
  if (process.env.PORTAL_AUTH_DISABLED === 'true') return;

  const url = new URL(request.url);
  const path = url.pathname;

  if (PUBLIC_PATHS.has(path)) return;
  if (PUBLIC_PREFIXES.some(p => path.startsWith(p))) return;

  const cookieHeader = request.headers.get('cookie') || '';
  const token = cookieHeader
    .split(';')
    .map(s => s.trim())
    .find(c => c.startsWith('grantiq_session='))
    ?.slice('grantiq_session='.length);

  if (token && (await verifySession(token))) return;

  if (path.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'auth required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const next = encodeURIComponent(path + (url.search || ''));
  return Response.redirect(new URL(`/login?next=${next}`, request.url), 302);
}

// ─── Web Crypto session verification ────────────────────────────────────────

async function verifySession(token) {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return false;
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return false;

    const expectedSig = await hmacSha256Base64Url(secret, payloadB64);
    if (!timingSafeEqualStr(expectedSig, sigB64)) return false;

    const payload = JSON.parse(b64UrlDecodeToString(payloadB64));
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function hmacSha256Base64Url(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return bytesToBase64Url(new Uint8Array(sigBuf));
}

function bytesToBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlDecodeToString(s) {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  return atob(b64);
}

function timingSafeEqualStr(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
