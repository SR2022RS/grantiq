// GET /api/data?table=<name>&<PostgREST query params>   — ADMIN ONLY (middleware gate)
// Read-only proxy the portal uses instead of the browser anon key, now that
// row-level security is on and the anon role can no longer read tables.
const READABLE = new Set([
  'orgs', 'grant_opportunities', 'document_vault', 'application_drafts',
  'alerts', 'agent_activity_log', 'agent_notes',
]);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const url = new URL(req.url, 'http://x');
  const table = url.searchParams.get('table');
  if (!READABLE.has(table)) return res.status(400).json({ error: 'table not allowed' });
  url.searchParams.delete('table');
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return res.status(500).json({ error: 'supabase not configured' });
  const r = await fetch(`${base}/rest/v1/${table}?${url.searchParams.toString()}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await r.text();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(r.status).send(body);
}
