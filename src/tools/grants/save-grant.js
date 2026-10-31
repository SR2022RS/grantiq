import { getSupabase } from '../../lib/supabase.js';

export const saveGrantSchema = {
  name: 'save_grant',
  description: 'Insert or update a grant in the pipeline. Use after discovery to persist findings. An existing grant (same org + name) keeps its pipeline status; only the fields you pass are updated.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      name: { type: 'string' },
      funder: { type: 'string', description: 'Funding agency or foundation' },
      agency: { type: 'string', description: 'Alias of funder' },
      amount: { type: 'string' },
      deadline: { type: 'string', description: 'ISO date (YYYY-MM-DD), or omit if rolling/unknown' },
      url: { type: 'string' },
      description: { type: 'string' },
      eligibility: { type: 'string' },
      region: { type: 'string' },
      match_score: { type: 'number', description: '0-100' },
      status: { type: 'string', description: "new (default), analyzing, eligible, drafting, review, submitted, awarded, rejected, expired, skipped" },
    },
    required: ['org_id', 'name'],
  },
};

const STATUSES = new Set(['new', 'analyzing', 'eligible', 'drafting', 'review', 'submitted', 'awarded', 'rejected', 'expired', 'skipped']);

function normScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function normDeadline(v) {
  if (!v || typeof v !== 'string') return null;
  const m = v.match(/\d{4}-\d{2}-\d{2}/);
  if (m && !Number.isNaN(Date.parse(m[0]))) return m[0];
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function saveGrant(input) {
  const supabase = getSupabase();
  const fields = {
    funder: input.funder || input.agency || null,
    amount: input.amount || null,
    deadline: normDeadline(input.deadline),
    url: input.url || null,
    description: input.description || null,
    eligibility: input.eligibility || null,
    region: input.region || null,
    match_score: input.match_score == null ? null : normScore(input.match_score),
  };
  // Drop empty values so an update never blanks out what's already there.
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null && v !== ''));

  const { data: existing, error: findErr } = await supabase
    .from('grant_opportunities')
    .select('id')
    .eq('org_id', input.org_id)
    .eq('name', input.name)
    .maybeSingle();
  if (findErr) return { ok: false, error: findErr.message };

  if (existing) {
    if (Object.keys(clean).length) {
      const { error } = await supabase
        .from('grant_opportunities')
        .update({ ...clean, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) return { ok: false, error: error.message };
    }
    return { ok: true, grant_id: existing.id, updated: true };
  }

  const status = STATUSES.has(input.status) ? input.status : 'new';
  const { data, error } = await supabase
    .from('grant_opportunities')
    .insert({ org_id: input.org_id, name: input.name, ...clean, status })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, grant_id: data.id, created: true };
}
