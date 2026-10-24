// GET /api/zip?org=<org_id>   — ADMIN ONLY (middleware gate)
// Streams a ZIP of every uploaded file for the org. Files are read from the
// private buckets with the service role. Stored (uncompressed) entries —
// PDFs and photos don't compress anyway — so no extra dependency is needed.
import { getSupabase } from '../src/lib/supabase.js';
import { resolveFile, fileNameOf } from '../src/lib/vault-files.js';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(d) {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}
export function buildZip(entries) {
  const parts = [], central = [];
  let offset = 0;
  const { time, date } = dosTime(new Date());
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8); local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(0, 10); cen.writeUInt16LE(time, 12); cen.writeUInt16LE(date, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}

export default async function handler(req, res) {
  const org = String(req.query.org || '');
  if (!/^[a-z0-9_]{2,40}$/.test(org)) return res.status(400).json({ error: 'org required' });
  const supabase = getSupabase();
  const { data: rows, error } = await supabase.from('document_vault')
    .select('id, doc_name, storage_path, file_url').eq('org_id', org).eq('status', 'uploaded').order('doc_name');
  if (error) return res.status(500).json({ error: 'vault lookup failed' });
  const withFiles = (rows || []).filter(r => resolveFile(r));
  if (!withFiles.length) return res.status(404).json({ error: 'no uploaded files for this org' });

  const used = new Set();
  const entries = [];
  for (const r of withFiles) {
    const f = resolveFile(r);
    const { data: blob, error: dlErr } = await supabase.storage.from(f.bucket).download(f.path);
    if (dlErr || !blob) { console.error('[zip] skip', r.id, dlErr?.message); continue; }
    const ext = (fileNameOf(r) || '').includes('.') ? '.' + fileNameOf(r).split('.').pop() : '';
    let base = String(r.doc_name || 'document').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100) + ext;
    let name = base, i = 2;
    while (used.has(name)) name = base.replace(/(\.[^.]*)?$/, ` (${i++})$1`);
    used.add(name);
    entries.push({ name, data: Buffer.from(await blob.arrayBuffer()) });
  }
  if (!entries.length) return res.status(502).json({ error: 'could not read any files' });

  const zip = buildZip(entries);
  const today = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${org}-documents-${today}.zip"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Length', zip.length);
  res.status(200).end(zip);
}
