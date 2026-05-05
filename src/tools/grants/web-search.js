export const webSearchSchema = {
  name: 'web_search',
  description: 'Search the web via Perplexity. Returns AI-synthesized answer + citations. Use for grant discovery, agency research, deadline verification.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      max_results: { type: 'number', description: 'Default 5' },
    },
    required: ['query'],
  },
};

export async function webSearch({ query, max_results = 5 }) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, error: 'PERPLEXITY_API_KEY not set' };

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: query }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `Perplexity ${res.status}: ${errText.slice(0, 200)}` };
  }
  const data = await res.json();
  return {
    ok: true,
    answer: data?.choices?.[0]?.message?.content || '',
    citations: (data?.citations || []).slice(0, max_results),
  };
}
