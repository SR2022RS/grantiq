// =============================================================================
// GrantIQ — Layer 2 (project facts) + Layer 3 (agent notes) loader
// =============================================================================
// Called once per chat turn. Returns a Markdown block to inject into the
// system prompt below the static persona.

import { getSupabase } from './supabase.js';

const NOTES_LOAD_LIMIT = 20;

export async function loadProjectContext({ agentName, queryKeywords = [] } = {}) {
  const supabase = getSupabase();

  // Layer 2: project facts via the agent_context_v view
  const { data: ctxRows, error: ctxErr } = await supabase
    .from('agent_context_v')
    .select('*');
  if (ctxErr) throw new Error(`[context] agent_context_v: ${ctxErr.message}`);

  // Layer 3: relevant notes — top N by tag match + recency
  let notesQuery = supabase
    .from('agent_notes')
    .select('id, agent_id, note, tags, confidence, created_at')
    .is('archived_at', null)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(NOTES_LOAD_LIMIT * 3); // overfetch, filter client-side by tag relevance
  const { data: rawNotes, error: notesErr } = await notesQuery;
  if (notesErr) throw new Error(`[context] agent_notes: ${notesErr.message}`);

  const notes = rankNotes(rawNotes || [], queryKeywords).slice(0, NOTES_LOAD_LIMIT);

  return renderContext({ ctxRows, notes });
}

function rankNotes(notes, keywords) {
  if (!keywords || keywords.length === 0) return notes;
  const kw = keywords.map((k) => k.toLowerCase());
  return [...notes].sort((a, b) => {
    const aScore = scoreNote(a, kw);
    const bScore = scoreNote(b, kw);
    if (aScore !== bScore) return bScore - aScore;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function scoreNote(note, kw) {
  const tagText = (note.tags || []).join(' ').toLowerCase();
  const noteText = (note.note || '').toLowerCase();
  let score = 0;
  for (const k of kw) {
    if (tagText.includes(k)) score += 3;
    if (noteText.includes(k)) score += 1;
  }
  if (note.confidence === 'high') score += 1;
  return score;
}

function renderContext({ ctxRows, notes }) {
  const orgs = (ctxRows || []).map((r) => ({
    org_id: r.org_id,
    name: r.org_name,
    profile_summary: summarizeProfile(r.org_profile),
    documents: r.documents,
    top_grants: r.top_grants,
    upcoming_deadlines: r.upcoming_deadlines,
  }));

  const lines = ['## Live project context (refreshed every turn)'];
  for (const org of orgs) {
    lines.push(`\n### ${org.name} (${org.org_id})`);
    lines.push(org.profile_summary);
    if (org.documents) {
      lines.push(`**Documents:** ${org.documents.uploaded}/${org.documents.total} uploaded.`);
      const missingList = (org.documents.missing_list || []).slice(0, 5);
      if (missingList.length) {
        lines.push(`Missing (top 5): ${missingList.map((m) => m.doc_name).join('; ')}`);
      }
    }
    if (org.top_grants && org.top_grants.length) {
      lines.push(`**Top grants:**`);
      for (const g of org.top_grants) {
        lines.push(`- ${g.name} (${g.match_score}% match, ${g.amount}, due ${g.deadline || 'n/a'}, ${g.status})`);
      }
    }
    if (org.upcoming_deadlines && org.upcoming_deadlines.length) {
      lines.push(`**Deadlines (next 30 days):** ${org.upcoming_deadlines.length}`);
    }
  }

  if (notes.length) {
    lines.push(`\n## Learned notes (Layer 3, top ${notes.length} by relevance)`);
    for (const n of notes) {
      lines.push(`- [${n.confidence}] ${n.note} (tags: ${(n.tags || []).join(', ')})`);
    }
  }

  return lines.join('\n');
}

function summarizeProfile(p) {
  if (!p) return '';
  const bits = [
    p.legalStructure,
    p.orgType,
    p.regions,
    p.uei ? `UEI ${p.uei}` : null,
    p.cage ? `CAGE ${p.cage}` : null,
    p.npi ? `NPI ${p.npi}` : null,
  ].filter(Boolean);
  const certs = (p.certifications || []).slice(0, 5).join(', ');
  return `${bits.join(' • ')}${certs ? `\nCertifications: ${certs}` : ''}`;
}
