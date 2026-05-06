// POST /api/orgs/create
// Body: {
//   id?, name, short?, mission?, ein?, uei?, address?, email?,
//   operations_lead?, certs?: string[], state?: string,
//   geographic_scope?: string[], orgType?: string, brief?: object
// }
// Response: { ok, org: {...}, scaffolded_templates: number }
//
// Creates a new org row + scaffolds 4 generic Markdown templates in
// org_templates so Draft-with-AI works on day one. Idempotent on `id`.

import { getSupabase } from '../../src/lib/supabase.js';
import { getScaffoldRows } from '../../src/lib/scaffold-templates.js';

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = req.body || {};
  const name = (body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = (body.id || slugify(name)).trim();
  if (!/^[a-z0-9_]{2,40}$/.test(id)) {
    return res.status(400).json({ error: 'id must match /^[a-z0-9_]{2,40}$/' });
  }

  const supabase = getSupabase();

  const { data: existing } = await supabase.from('orgs').select('id').eq('id', id).maybeSingle();
  if (existing) {
    return res.status(409).json({ error: `org "${id}" already exists` });
  }

  const data = {
    id,
    name,
    short: body.short || name,
    orgType: body.orgType || '',
    mission: body.mission || '',
    state: body.state || '',
    ein: body.ein || '',
    uei: body.uei || '',
    cage: body.cage || '',
    npi: body.npi || '',
    address: body.address || '',
    email: body.email || '',
    operationsLead: body.operations_lead || body.operationsLead || '',
    certs: Array.isArray(body.certs) ? body.certs : [],
    geographic_scope: Array.isArray(body.geographic_scope) ? body.geographic_scope : [],
    brief: body.brief || {},
  };

  const { error: insertErr } = await supabase
    .from('orgs')
    .insert({ id, name, data, updated_at: new Date().toISOString() });
  if (insertErr) {
    return res.status(500).json({ error: 'insert failed: ' + insertErr.message });
  }

  const scaffold = getScaffoldRows(id);
  const { error: tplErr } = await supabase
    .from('org_templates')
    .upsert(scaffold, { onConflict: 'org_id,doc_type' });
  if (tplErr) {
    console.error('[orgs/create] template scaffold failed:', tplErr.message);
  }

  return res.status(200).json({
    ok: true,
    org: { id, name, ...data },
    scaffolded_templates: tplErr ? 0 : scaffold.length,
  });
}
