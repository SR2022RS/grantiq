// POST /api/orgs/draft-doc
// Body: { org_id, doc_type }
// Response: { ok, doc_type, template_kind, draft_content, doc_id?, message }
//
// Thin wrapper around the generate_document tool so the Vault UI can draft a
// single missing doc without going through the full /api/grants/chat flow.

import { generateDocument } from '../../src/tools/grants/generate-document.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { org_id, doc_type, grant_id } = req.body || {};
  if (!org_id || !doc_type) {
    return res.status(400).json({ error: 'org_id and doc_type required' });
  }
  try {
    const result = await generateDocument({ org_id, doc_type, grant_id });
    if (!result.ok) {
      return res.status(404).json(result);
    }
    return res.status(200).json(result);
  } catch (e) {
    console.error('[draft-doc] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
