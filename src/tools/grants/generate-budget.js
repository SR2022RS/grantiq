import { getSupabase } from '../../lib/supabase.js';
import { MODEL } from '../../lib/constants.js';
import { makeLLMClient, modelId } from '../../lib/llm-client.js';

export const generateBudgetSchema = {
  name: 'generate_budget',
  description: 'Generate a line-item budget for a grant. Returns categorized line items totaling the grant amount.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
      amount: { type: 'number', description: 'Total grant amount in dollars' },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional — specific line categories to use',
      },
    },
    required: ['grant_id', 'org_id', 'amount'],
  },
};

export async function generateBudget({ grant_id, org_id, amount, categories }) {
  const supabase = getSupabase();
  const [{ data: grant }, { data: org }] = await Promise.all([
    supabase.from('grant_opportunities').select('*').eq('id', grant_id).single(),
    supabase.from('orgs').select('*').eq('id', org_id).single(),
  ]);
  if (!grant || !org) return { ok: false, error: 'grant or org not found' };

  const client = makeLLMClient();
  const response = await client.messages.create({
    model: modelId(MODEL),
    max_tokens: 2048,
    system: 'You are a grant budget specialist. Output ONLY valid JSON: {"line_items": [{"category": "<cat>", "description": "<desc>", "amount": <number>, "justification": "<one sentence>"}], "total": <number>, "indirect_rate": <number 0-1>}. Indirect rate ≤12% for federal. Sum of line_items.amount must equal total.',
    messages: [{
      role: 'user',
      content: `Generate a $${amount} budget.\n\nGRANT:\n${JSON.stringify(grant, null, 2)}\n\nORG:\n${JSON.stringify(org.data, null, 2)}\n\n${categories ? `Required categories: ${categories.join(', ')}` : 'Choose appropriate categories.'}`,
    }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON in response' };
  return { ok: true, budget: JSON.parse(m[0]) };
}
