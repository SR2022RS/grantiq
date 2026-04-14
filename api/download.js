// Proxy download endpoint — forces Content-Disposition: attachment so browsers
// reliably save the file instead of opening it in a tab (Safari in particular
// ignores the HTML `download` attribute on cross-origin links).
//
// Usage: /api/download?url=<supabase-storage-url>&name=<filename>
//
// Only Supabase Storage URLs for our project are permitted — stops the proxy
// from being used to fetch arbitrary URLs on the internet.

const ALLOWED_HOST = 'zamokpkpneedvluthsem.supabase.co';

module.exports = async (req, res) => {
  const { url, name } = req.query || {};

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'url query param required' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'invalid url' });
    return;
  }

  if (parsed.hostname !== ALLOWED_HOST) {
    res.status(403).json({ error: 'only Supabase Storage URLs permitted' });
    return;
  }

  let upstream;
  try {
    upstream = await fetch(url);
  } catch (err) {
    res.status(502).json({ error: `fetch failed: ${err.message}` });
    return;
  }

  if (!upstream.ok) {
    res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
    return;
  }

  const safeName = sanitizeFilename(name || fallbackNameFromUrl(parsed.pathname));
  const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
  const contentLength = upstream.headers.get('content-length');

  res.setHeader('Content-Type', contentType);
  if (contentLength) res.setHeader('Content-Length', contentLength);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`);
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  // Stream the body straight through so large files don't buffer in memory.
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    try { res.end(); } catch {}
  }
};

function sanitizeFilename(name) {
  return String(name || 'download').replace(/[\r\n"\\]/g, '_').slice(0, 200) || 'download';
}

function fallbackNameFromUrl(pathname) {
  try {
    return decodeURIComponent(pathname.split('/').pop() || 'download');
  } catch {
    return 'download';
  }
}
