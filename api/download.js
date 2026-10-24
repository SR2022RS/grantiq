// GET /api/download?doc_id=<uuid>   — ADMIN ONLY (middleware gate)
// Kept for old links: forces a download via a short-lived signed URL.
// The old ?url= form (public storage URLs) is no longer supported.
import fileHandler from './file.js';

export default async function handler(req, res) {
  if (!req.query.doc_id) return res.status(400).json({ error: 'doc_id required' });
  req.query.download = '1';
  return fileHandler(req, res);
}
