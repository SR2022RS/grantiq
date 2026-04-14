// Bulk download — streams a ZIP of every uploaded doc for the given org.
// Allows Rodney to pull Tiffany's entire vault in one click instead of
// 22 sequential "save as" dialogs.
//
// Usage: /api/zip?org=k1_management   (or holigenix_healthcare)
//
// Query path: Supabase document_vault filtered to status=uploaded, then
// fetches each file_url in parallel (bounded) and archiver streams the
// ZIP directly to the response. No intermediate disk I/O.

const archiver = require('archiver');

const SB_URL = 'https://zamokpkpneedvluthsem.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphbW9rcGtwbmVlZHZsdXRoc2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODM2OTEsImV4cCI6MjA5MTE1OTY5MX0.dLRU-LFZe_1q5383OVYMjpVX2bhbHHwco90kzY8MqI4';

const ORG_LABELS = {
  k1_management: 'K1-Management',
  holigenix_healthcare: 'Holigenix-Healthcare',
};

module.exports = async (req, res) => {
  const org = (req.query && req.query.org) || '';
  if (!ORG_LABELS[org]) {
    res.status(400).json({ error: 'org must be k1_management or holigenix_healthcare' });
    return;
  }

  let docs;
  try {
    const listResp = await fetch(
      `${SB_URL}/rest/v1/document_vault?org_id=eq.${org}&status=eq.uploaded&select=doc_name,doc_type,file_url,uploaded_at&order=doc_name`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!listResp.ok) throw new Error(`vault query ${listResp.status}`);
    docs = await listResp.json();
  } catch (err) {
    res.status(502).json({ error: `vault lookup failed: ${err.message}` });
    return;
  }

  if (!Array.isArray(docs) || docs.length === 0) {
    res.status(404).json({ error: 'no uploaded documents for this org' });
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const archiveName = `${ORG_LABELS[org]}-documents-${today}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.on('warning', (err) => {
    if (err.code !== 'ENOENT') console.error('[zip] warning:', err);
  });
  archive.on('error', (err) => {
    console.error('[zip] error:', err);
    try { res.status(500).end(); } catch {}
  });

  archive.pipe(res);

  // Fetch files in parallel (small concurrency) and append as streams.
  const CONCURRENCY = 4;
  let index = 0;
  const fetched = new Array(docs.length);

  async function worker() {
    while (index < docs.length) {
      const i = index++;
      const doc = docs[i];
      if (!doc.file_url) { fetched[i] = null; continue; }

      try {
        const r = await fetch(doc.file_url);
        if (!r.ok) {
          console.error(`[zip] skipping ${doc.doc_name}: status ${r.status}`);
          fetched[i] = null;
          continue;
        }
        const ab = await r.arrayBuffer();
        fetched[i] = Buffer.from(ab);
      } catch (err) {
        console.error(`[zip] skipping ${doc.doc_name}: ${err.message}`);
        fetched[i] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Append in original order so the ZIP is deterministic.
  docs.forEach((doc, i) => {
    const buf = fetched[i];
    if (!buf) return;
    const ext = extFromUrl(doc.file_url) || '';
    const safeName = sanitize(doc.doc_name) + ext;
    archive.append(buf, { name: safeName });
  });

  await archive.finalize();
};

function sanitize(s) {
  return String(s || 'document')
    .replace(/[\r\n\/\\?%*:|"<>]/g, '_')
    .trim()
    .slice(0, 150) || 'document';
}

function extFromUrl(url) {
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.([a-zA-Z0-9]{1,8})$/);
    return m ? `.${m[1].toLowerCase()}` : '';
  } catch {
    return '';
  }
}
