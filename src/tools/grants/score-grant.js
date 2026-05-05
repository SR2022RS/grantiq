import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../lib/supabase.js';
import { MODEL } from '../../lib/constants.js';

export const scoreGrantSchema = {
  name: 'score_grant',
  description: 'LLM-based eligibility score (0-100) for a grant against an org profile. Writes the score back to grant_opportunities.match_score.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
    },
    required: ['grant_id', 'org_id'],
  },
};

export async function scoreGrant({ grant_id, org_id }) {
  const supabase = getSupabase();
  const [{ data: grant }, { data: org }] = await Promise.all([
    supabase.from('grant_opportunities').select('*').eq('id', grant_id).single(),
    supabase.from('orgs').select('*').eq('id', org_id).single(),
  ]);
  if (!grant) return { ok: false, error: 'grant not found' };
  if (!org) return { ok: false, error: 'org not found' };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: 'You are a grant eligibility analyst. Output ONLY a JSON object: {"score": <0-100>, "rationale": "<one sentence>"}.',
    messages: [{
      role: 'user',
      content: `Score this grant (0-100) for org fit.\n\nORG:\n${JSON.stringify(org.data, null, 2)}\n\nGRANT:\n${JSON.stringify(grant, null, 2)}`,
    }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON in response' };
  const parsed = JSON.parse(m[0]);
  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

  await supabase
    .from('grant_opportunities')
    .update({ match_score: score })
    .eq('id', grant_id);

  return { ok: true, grant_id, score, rationale: parsed.rationale };
}
