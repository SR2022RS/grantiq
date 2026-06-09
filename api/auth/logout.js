// GET or POST /api/auth/logout — PUBLIC. Clears the session cookie.
// GET redirects to /; POST returns JSON (for fetch from the Command Center).

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', [
    'grantiq_session=',
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; '));
  const accepts = String(req.headers['accept'] || '');
  if (req.method === 'GET' && accepts.includes('text/html')) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }
  return res.status(200).json({ ok: true });
}
