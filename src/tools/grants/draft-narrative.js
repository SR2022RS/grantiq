import { getSupabase } from '../../lib/supabase.js';
import { MODEL } from '../../lib/constants.js';
import { makeLLMClient, modelId } from '../../lib/llm-client.js';

export const draftNarrativeSchema = {
  name: 'draft_narrative',
  description: 'Generate an application narrative for a grant. Returns a structured narrative ready to be saved as a draft.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
      sections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Section names to draft (e.g., ["needs", "approach", "outcomes"])',
      },
      prior_draft_id: { type: 'string', description: 'Optional — to revise rather than start fresh' },
      tone_notes: { type: 'string', description: 'Optional voice/tone guidance from prior wins' },
    },
    required: ['grant_id', 'org_id'],
  },
};

const DEFAULT_SECTIONS = ['executive_summary', 'organizational_capacity', 'needs_statement', 'project_approach', 'outcomes_and_evaluation', 'sustainability'];

export async function draftNarrative({ grant_id, org_id, sections = DEFAULT_SECTIONS, prior_draft_id, tone_notes }) {
  const supabase = getSupabase();
  const [{ data: grant }, { data: org }] = await Promise.all([
    supabase.from('grant_opportunities').select('*').eq('id', grant_id).single(),
    supabase.from('orgs').select('*').eq('id', org_id).single(),
  ]);
  if (!grant || !org) return { ok: false, error: 'grant or org not found' };

  let priorDraft = null;
  if (prior_draft_id) {
    const r = await supabase.from('application_drafts').select('narrative').eq('id', prior_draft_id).single();
    priorDraft = r.data?.narrative || null;
  }

  const phiRule = org.id === 'holigenix_healthcare' ? 'NEVER include patient names, ages, conditions, or any PHI.' : '';
  const leadAngle = org.id === 'holigenix_healthcare'
    ? 'Lead with 508(c)(1)(a) faith-based status for foundation grants; SDVOSB for federal.'
    : org.id === 'k1_management'
      ? 'Lead with COSTARS (March 2026 acceptance) for PA grants; Delaware OSD/SBF for DE grants; MWBE-NJ for NJ grants.'
      : '';

  const client = makeLLMClient();
  const response = await client.messages.create({
    model: modelId(MODEL),
    max_tokens: 4096,
    system: `You are a senior grant writer. Output ONLY valid JSON: {"sections": {<section_name>: "<text>"}}. Each section is 200-500 words, professional voice, specific to the grant. ${phiRule} ${leadAngle} ${tone_notes || ''}`,
    messages: [{
      role: 'user',
      content: `Draft these sections: ${sections.join(', ')}.\n\nGRANT:\n${JSON.stringify(grant, null, 2)}\n\nORG PROFILE:\n${JSON.stringify(org.data, null, 2)}\n\n${priorDraft ? `PRIOR DRAFT (revise, don't start over):\n${JSON.stringify(priorDraft)}` : ''}`,
    }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON in response' };
  return { ok: true, narrative: JSON.parse(m[0]) };
}
