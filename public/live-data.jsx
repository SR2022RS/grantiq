// =============================================================================
// Live data loader — replaces mock arrays with real Supabase + API data
// =============================================================================
// Pattern: on App mount, fetch from Supabase + our own /api/* endpoints,
// mutate window.MOCK in place, then trigger a re-render. Mocked tables that
// don't yet have backing DB tables (FUNDERS, WATCHLISTS, etc.) stay as-is.
//
// Public anon key is safe in browser — it's the same one already used by
// /k1-upload.html and /holigenix-upload.html. Service-role operations go
// through /api/* endpoints (server-side).

const SB_URL = 'https://zamokpkpneedvluthsem.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphbW9rcGtwbmVlZHZsdXRoc2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODM2OTEsImV4cCI6MjA5MTE1OTY5MX0.dLRU-LFZe_1q5383OVYMjpVX2bhbHHwco90kzY8MqI4';

async function sbGet(table, query = '') {
  const url = `${SB_URL}/rest/v1/${table}${query}`;
  const r = await fetch(url, { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON } });
  if (!r.ok) throw new Error(`Supabase ${table}: HTTP ${r.status}`);
  return r.json();
}

// ─── Mappers — DB row → mock-shape used by views ─────────────────────────

function mapOrg(row) {
  const data = row.data || {};
  const certs = (data.certifications || []).slice(0, 6);
  return {
    id: row.id,
    short:
      row.id === 'holigenix_healthcare' ? 'Holigenix' :
      row.id === 'k1_management'        ? 'K1 Mgmt'   :
      row.id === 'owner_nonprofit'      ? 'Owner NP'  : row.id,
    name: row.name,
    certs,
  };
}

function mapGrant(row, vaultIndex) {
  // Compute docs_ready / docs_total for this grant's org
  const orgVault = vaultIndex.get(row.org_id) || { uploaded: 0, total: 0 };
  return {
    id: row.id,
    name: row.name,
    funder: row.funder || '',
    org_id: row.org_id,
    amount: row.amount || '—',
    deadline: row.deadline,
    match_score: row.match_score || 0,
    status: row.status || 'new',
    docs_ready: orgVault.uploaded,
    docs_total: orgVault.total,
    source: row.source || '',
    description: row.description || '',
    eligibility: Array.isArray(row.eligibility) ? row.eligibility : (row.eligibility ? [row.eligibility] : []),
    advantage: row.certification_advantage || '',
  };
}

function mapVaultDoc(row) {
  return {
    id: row.id,
    org_id: row.org_id,
    required_for: row.required_for || 'all',
    doc_name: row.doc_name,
    description: row.description || '',
    status: row.status,
    uploaded_at: row.uploaded_at,
    expires: row.expiry_date,
    template_kind: row.template_kind,
    draft_content: row.draft_content,
    drafted_at: row.drafted_at,
    file_url: row.file_url,
  };
}

function mapDraft(row, grantsById) {
  const grant = grantsById.get(row.grant_id);
  return {
    id: row.id,
    grant_id: row.grant_id,
    grant_name: grant?.name || '(unknown grant)',
    org_id: row.org_id,
    status: row.status === 'draft' ? 'drafting' : (row.status || 'drafting'),
    word_count: typeof row.narrative === 'object'
      ? Object.values(row.narrative || {}).join(' ').split(/\s+/).filter(Boolean).length
      : 0,
    sections: typeof row.narrative === 'object' ? Object.keys(row.narrative || {}) : [],
    last_updated: row.updated_at || row.created_at,
    has_budget: !!(row.budget && Object.keys(row.budget).length),
  };
}

function mapSession(row) {
  // Map real session row → mock-shape used by SessionsView (started, step, total, reason, screenshots-count)
  const shotsArr = Array.isArray(row.screenshots) ? row.screenshots : [];
  return {
    id: row.id,
    grant_id: row.grant_id,
    org_id: row.org_id,
    url: row.application_url,
    status: row.status,
    step: row.current_step || 0,
    total: row.total_steps || 0,
    reason: row.gate_reason || '',
    started: row.started_at,
    ended_at: row.ended_at,
    screenshots: shotsArr.length, // view expects count, not array
    screenshot_urls: shotsArr,    // keep array for detail panel
  };
}

function mapAlert(row) {
  return {
    id: row.id,
    severity: row.severity,
    created: row.created_at,
    title: row.message,
    body: row.message,
    page: row.link?.startsWith('/') ? row.link.slice(1).split('?')[0].split('.')[0] : null,
    session_id: row.link?.includes('/sessions') ? row.link.split('=')[1] : null,
    read: !!row.read_at,
  };
}

function mapActivity(row) {
  return {
    id: row.id,
    t: row.created_at,
    agent: row.agent_id,
    text: `${row.action}${row.detail ? ': ' + row.detail : ''}`,
  };
}

function mapNote(row) {
  return {
    id: row.id,
    agent: row.agent_id,
    confidence: row.confidence,
    tags: row.tags || [],
    created: row.created_at,
    text: row.note,
  };
}

// ─── Main loader ────────────────────────────────────────────────────────

async function loadLiveData() {
  // Parallel fetch — most tables are independent
  const [orgs, grants, vault, drafts, alerts, activity, notes] = await Promise.all([
    sbGet('orgs',                  '?select=*'),
    sbGet('grant_opportunities',   '?select=*&order=match_score.desc.nullslast&limit=200'),
    sbGet('document_vault',        '?select=*&limit=500'),
    sbGet('application_drafts',    '?select=*&order=created_at.desc&limit=100'),
    sbGet('alerts',                '?select=*&order=created_at.desc&limit=50'),
    sbGet('agent_activity_log',    '?select=*&order=created_at.desc&limit=30'),
    sbGet('agent_notes',           '?select=*&archived_at=is.null&order=created_at.desc&limit=100'),
  ]);

  // Sessions come from our API (which adds field normalization)
  let sessions = [];
  try {
    const sr = await fetch('/api/playwright/sessions');
    if (sr.ok) {
      const sj = await sr.json();
      sessions = sj.sessions || [];
    }
  } catch (_) { /* fall through */ }

  // Build vault aggregation index for grant docs_ready/docs_total
  const vaultByOrg = new Map();
  for (const v of vault) {
    if (!vaultByOrg.has(v.org_id)) vaultByOrg.set(v.org_id, { uploaded: 0, total: 0 });
    const agg = vaultByOrg.get(v.org_id);
    agg.total += 1;
    if (v.status === 'uploaded') agg.uploaded += 1;
  }

  const mappedGrants = grants.map((g) => mapGrant(g, vaultByOrg));
  const grantsById = new Map(mappedGrants.map((g) => [g.id, g]));

  return {
    ORGS: [{ id: 'all', short: 'All', name: 'All Orgs' }, ...orgs.map(mapOrg)],
    GRANTS: mappedGrants,
    VAULT: vault.map(mapVaultDoc),
    DRAFTS: drafts.map((d) => mapDraft(d, grantsById)),
    SESSIONS: sessions.map(mapSession),
    ALERTS: alerts.map(mapAlert),
    AGENT_ACTIVITY: activity.map(mapActivity),
    NOTES: notes.map(mapNote),
  };
}

// Expose globally for App.jsx bootstrap
window.loadLiveData = loadLiveData;
