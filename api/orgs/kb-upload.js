// POST /api/orgs/kb-upload — upload a PDF/image to the org-kb Supabase
// Storage bucket and create an org_kb_files row. The browser POSTs raw
// bytes (multipart/form-data) which we forward to Supabase Storage.
//
// Query params: org_id, filename, mime_type
// Body: raw bytes
//
// Response: { ok, file: { id, filename, storage_path, size_bytes, mime_type } }

import { getSupabase } from '../../src/lib/supabase.js';
import { randomUUID } from 'crypto';

export const config = {
  api: {
    bodyParser: false, // we read the raw request body
  },
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'text/markdown', 'text/plain',
]);

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BYTES) {
      throw new Error('file exceeds 25 MB limit');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { org_id, filename, mime_type } = req.query;
  if (!org_id || !filename || !mime_type) {
    return res.status(400).json({ error: 'org_id, filename, mime_type query params required' });
  }
  if (!ALLOWED_MIME.has(mime_type)) {
    return res.status(415).json({ error: `mime_type "${mime_type}" not allowed`, allowed: [...ALLOWED_MIME] });
  }

  let bytes;
  try {
    bytes = await readBody(req);
  } catch (e) {
    return res.status(413).json({ error: e.message });
  }
  if (bytes.length === 0) return res.status(400).json({ error: 'empty body' });

  const supabase = getSupabase();
  const safeName = String(filename).replace(/[^\w.\- ]/g, '_').slice(0, 200);
  const storagePath = `${org_id}/${Date.now()}_${randomUUID().slice(0, 8)}_${safeName}`;

  const { error: upErr } = await supabase
    .storage
    .from('org-kb')
    .upload(storagePath, bytes, { contentType: mime_type, upsert: false });
  if (upErr) {
    return res.status(500).json({ error: 'storage upload failed: ' + upErr.message });
  }

  const { data: row, error: insErr } = await supabase
    .from('org_kb_files')
    .insert({
      org_id,
      filename: safeName,
      mime_type,
      size_bytes: bytes.length,
      storage_path: storagePath,
    })
    .select('*')
    .single();
  if (insErr) {
    // Clean up the orphaned upload
    await supabase.storage.from('org-kb').remove([storagePath]);
    return res.status(500).json({ error: 'db insert failed: ' + insErr.message });
  }

  return res.status(200).json({ ok: true, file: row });
}
