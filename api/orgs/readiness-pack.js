// GET /api/orgs/readiness-pack?org_id=holigenix_healthcare
// Generates all draftable missing docs for an org and streams back a ZIP archive.
// Uses archiver (lightweight) so we don't reinvent the ZIP format.
//
// Supabase env vars required: ANTHROPIC_API_KEY (no — only for chat, this endpoint doesn't call LLM),
//                              SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { getSupabase } from '../../src/lib/supabase.js';
import {
  listAvailableDraftableTemplates,
  readTemplateForOrg,
  renderTemplate,
  getDocTypeMetadata,
  resolveDocType,
} from '../../src/lib/document-catalog.js';
import { deflateRawSync } from 'zlib';
import { createHash } from 'crypto';

// Minimal ZIP writer — produces a valid .zip from { name, content } entries.
// Implements ZIP local file header + central directory format. No compression on small text;
// we use deflate because it's still cheap and brings the archive under typical email limits.
function buildZip(files) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const { name, content } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const contentBuf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    const compressed = deflateRawSync(contentBuf);
    const crc = crc32(contentBuf);

    // Local file header
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(8, 8); // compression: deflate
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(contentBuf.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localChunks.push(localHeader, nameBuf, compressed);

    // Central directory header
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(8, 10); // compression
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0, 14); // mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(contentBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralChunks.push(centralHeader, nameBuf);

    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const localBuf = Buffer.concat(localChunks);
  const centralBuf = Buffer.concat(centralChunks);

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where central directory starts
  eocd.writeUInt16LE(files.length, 8); // entries on this disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(centralBuf.length, 12); // size of central directory
  eocd.writeUInt32LE(localBuf.length, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

// Standard CRC-32 for ZIP
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function buildIndexDoc(orgName, items) {
  const lines = [
    `# ${orgName} — Grant Readiness Pack`,
    '',
    `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    '',
    '## How to use',
    '',
    'Each `.md` file in this archive is a starter for one of the documents your grant applications need. Open in any text editor or paste into Word.',
    '',
    '1. Fill in every `[BRACKETED PLACEHOLDER]`.',
    '2. For Letters of Support: delete the `INSTRUCTIONS — DELETE BEFORE SENDING` panel before forwarding to the partner.',
    '3. Save as PDF.',
    '4. Upload to GrantIQ at https://grantiq-ivory.vercel.app',
    '',
    '## Files in this pack',
    '',
  ];
  for (const item of items) {
    lines.push(`- **${item.name}** — \`${item.filename}\``);
  }
  return lines.join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

  const orgId = req.query.org_id || req.query.orgId;
  if (!orgId) return res.status(400).json({ error: 'org_id required' });

  try {
    const supabase = getSupabase();

    // Pull org profile
    const { data: org, error: orgErr } = await supabase
      .from('orgs')
      .select('name, data')
      .eq('id', orgId)
      .single();
    if (orgErr || !org) return res.status(404).json({ error: `org not found: ${orgId}` });
    const orgData = org.data || {};

    // Find missing draftable docs in the vault
    const { data: missingDocs, error: vaultErr } = await supabase
      .from('document_vault')
      .select('id, doc_type, doc_name')
      .eq('org_id', orgId)
      .eq('status', 'missing');
    if (vaultErr) return res.status(500).json({ error: vaultErr.message });

    const draftable = listAvailableDraftableTemplates(orgId);

    // Build a single deduplicated list keyed by CANONICAL doc_type.
    // Vault rows (which may use aliases like letter_of_support_1) take priority
    // for naming; standalone templates fill in canonical entries the vault doesn't have.
    const byCanonical = new Map();

    // First pass: vault rows whose canonical type has a template on disk
    for (const row of (missingDocs || [])) {
      const canonical = resolveDocType(row.doc_type);
      if (!draftable.includes(canonical)) continue;
      if (byCanonical.has(canonical)) continue; // first row wins on naming
      const tpl = readTemplateForOrg(orgId, canonical);
      if (!tpl) continue;
      byCanonical.set(canonical, {
        doc_type: canonical,
        name: row.doc_name || getDocTypeMetadata(canonical)?.title || canonical,
        filename: `${canonical}.md`,
        content: renderTemplate(tpl, orgData),
      });
    }

    // Second pass: catalog templates not yet covered by a vault row
    for (const dt of draftable) {
      if (byCanonical.has(dt)) continue;
      const tpl = readTemplateForOrg(orgId, dt);
      if (!tpl) continue;
      const meta = getDocTypeMetadata(dt);
      byCanonical.set(dt, {
        doc_type: dt,
        name: meta?.title || dt,
        filename: `${dt}.md`,
        content: renderTemplate(tpl, orgData),
      });
    }

    const items = Array.from(byCanonical.values());

    if (items.length === 0) {
      return res.status(404).json({
        error: `no draftable templates available for ${orgId}`,
        hint: `Add Markdown templates under workspace/templates/${orgId}/`,
      });
    }

    // Add the START HERE index
    const indexContent = buildIndexDoc(org.name || orgId, items);
    const files = [
      { name: '_START_HERE.md', content: indexContent },
      ...items.map((it) => ({ name: it.filename, content: it.content })),
    ];

    const zipBuf = buildZip(files);
    const fileName = `${orgId}-readiness-pack-${new Date().toISOString().slice(0, 10)}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', zipBuf.length);
    return res.status(200).end(zipBuf);
  } catch (e) {
    console.error('[readiness-pack] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
