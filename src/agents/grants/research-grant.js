// Research a single manually-added grant — async background workflow.
//
// Runs the Grants agent with a focused "research this URL" prompt, parses
// the structured findings, and writes them back to grant_opportunities.
//
// Designed to be fire-and-forget from the Add Grant API:
//
//   res.status(200).json({ ok: true, grant_id });
//   setTimeout(() => researchGrant({ grant_id }).catch(console.error), 0);

import { getSupabase } from '../../lib/supabase.js';
import { runGrantsTurn } from './index.js';

const RESEARCH_PROMPT_TEMPLATE = `You are researching a grant for {{ORG_NAME}} ({{ORG_ID}}).

Grant details so far:
- Name: {{NAME}}
- Funder: {{FUNDER}}
- Amount: {{AMOUNT}}
- Deadline: {{DEADLINE}}
- URL: {{URL}}
- User notes: {{NOTES}}

Use the fetch_url and web_search tools to research this grant. Then write a structured research report. Format your final response as Markdown with these exact sections (use these headings):

## Eligibility match
A 2-3 sentence assessment of whether {{ORG_NAME}} qualifies, with specific criteria from the grant page (revenue thresholds, geography, org type, certifications required).

## Required documents
A bulleted list of every document the application requires. Map each to whether {{ORG_NAME}} likely has it (use the document_vault context). Mark "MISSING" or "READY".

## Eligibility risks
Any disqualifying factors worth flagging (geographic exclusions, revenue caps, sector restrictions, deadlines that are too tight).

## Match score
Single integer 0-100 reflecting fit. Be honest — not every grant is a match.

## Recommendation
One sentence: should we apply, skip, or watchlist?

Keep it tight. The user is reviewing this on the portal — they want signal, not filler.`;

export async function researchGrant({ grant_id }) {
  const supabase = getSupabase();
  const startedAt = new Date().toISOString();

  // Mark running
  await supabase
    .from('grant_opportunities')
    .update({ research_status: 'running', research_started_at: startedAt })
    .eq('id', grant_id);

  try {
    const { data: grant, error: gErr } = await supabase
      .from('grant_opportunities')
      .select('*')
      .eq('id', grant_id)
      .single();
    if (gErr || !grant) throw new Error(`grant ${grant_id} not found: ${gErr?.message}`);

    const { data: org } = await supabase
      .from('orgs')
      .select('id, name')
      .eq('id', grant.org_id)
      .maybeSingle();

    const userMessage = RESEARCH_PROMPT_TEMPLATE
      .replaceAll('{{ORG_NAME}}', org?.name || grant.org_id)
      .replaceAll('{{ORG_ID}}',   grant.org_id || '?')
      .replaceAll('{{NAME}}',     grant.name || '(unspecified)')
      .replaceAll('{{FUNDER}}',   grant.funder || '(unspecified)')
      .replaceAll('{{AMOUNT}}',   grant.amount || '(unspecified)')
      .replaceAll('{{DEADLINE}}', grant.deadline || '(unspecified)')
      .replaceAll('{{URL}}',      grant.submitted_url || '(none provided)')
      .replaceAll('{{NOTES}}',    grant.description || '(none)');

    const result = await runGrantsTurn({
      userMessage,
      userChatId: 'system_grant_research',
    });

    // Try to extract a match_score from the report so the pipeline can re-rank
    const text = result?.text || '';
    const scoreMatch = text.match(/match score[\s\S]{0,40}?(\d{1,3})/i);
    const match_score = scoreMatch ? Math.min(100, parseInt(scoreMatch[1], 10)) : null;

    await supabase
      .from('grant_opportunities')
      .update({
        research_status: 'complete',
        research_completed_at: new Date().toISOString(),
        research_report: { markdown: text, status: result.status, telemetry: result.telemetry },
        match_score: match_score ?? grant.match_score,
      })
      .eq('id', grant_id);

    return { ok: true, grant_id, match_score };
  } catch (e) {
    await supabase
      .from('grant_opportunities')
      .update({
        research_status: 'failed',
        research_completed_at: new Date().toISOString(),
        research_report: { error: e.message },
      })
      .eq('id', grant_id);
    return { ok: false, grant_id, error: e.message };
  }
}
