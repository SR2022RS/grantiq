// HTTP Basic Auth gate for the entire portal — gates pages AND API routes
// before they hit any function. Only Vercel cron routes are excluded
// (they authenticate via x-vercel-signature, not a browser session).
//
// Set PORTAL_PASSWORD in Vercel env vars. Username is hardcoded to "partner".
// To revoke access: rotate PORTAL_PASSWORD and redeploy. To turn off entirely:
// delete this file (or set PORTAL_AUTH_DISABLED=true) and redeploy.

export const config = {
  matcher: '/((?!api/cron/|_vercel/|favicon\\.ico).*)',
};

export default function middleware(request) {
  if (process.env.PORTAL_AUTH_DISABLED === 'true') return;

  const expected = process.env.PORTAL_PASSWORD;
  if (!expected) {
    // Fail open if the env var was never set so an accidental deploy doesn't
    // brick the portal. Log so it's visible in Vercel runtime logs.
    console.warn('[middleware] PORTAL_PASSWORD not set — auth bypassed');
    return;
  }

  const header = request.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    const decoded = atob(header.slice(6));
    const [, password] = decoded.split(':', 2);
    if (password === expected) return;
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="GrantIQ", charset="UTF-8"',
      'Content-Type': 'text/plain',
    },
  });
}
