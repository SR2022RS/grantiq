export const webSearchSchema = {
  name: 'web_search',
  description: 'Search the web. Returns an AI-synthesized answer + citations. Use for grant discovery, agency research, deadline verification.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      max_results: { type: 'number', description: 'Default 5' },
    },
    required: ['query'],
  },
};

function citationsFrom(data, max) {
  const direct = Array.isArray(data?.citations) ? data.citations : [];
  const annotated = (data?.choices?.[0]?.message?.annotations || [])
    .map((a) => a?.url_citation?.url || a?.url)
    .filter(Boolean);
  return [...new Set([...direct, ...annotated])].slice(0, max);
}

async function searchVia(url, key, model, query, extraHeaders = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: query }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: errText.slice(0, 200) };
  }
  return { ok: true, data: await res.json() };
}

export async function webSearch({ query, max_results = 5 }) {
  const pplxKey = process.env.PERPLEXITY_API_KEY;
  const routerKey = process.env.OPENROUTER_API_KEY;
  let firstError = null;

  if (pplxKey) {
    const r = await searchVia('https://api.perplexity.ai/chat/completions', pplxKey, 'sonar', query);
    if (r.ok) {
      return { ok: true, answer: r.data?.choices?.[0]?.message?.content || '', citations: citationsFrom(r.data, max_results) };
    }
    firstError = `Perplexity ${r.status}: ${r.error}`;
    // Only fall back when the key itself is the problem (missing/expired/no credit).
    if (![401, 402, 403].includes(r.status)) return { ok: false, error: firstError };
  }

  // Fallback: the same Sonar search model through the LLM router account.
  if (routerKey) {
    const r = await searchVia('https://openrouter.ai/api/v1/chat/completions', routerKey, 'perplexity/sonar', query, {
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://grantiq.operatorhq.agency',
      'X-Title': process.env.OPENROUTER_TITLE || 'GrantIQ Command Center',
    });
    if (r.ok) {
      if (firstError) console.warn(`[web_search] ${firstError}; used router fallback`);
      return { ok: true, answer: r.data?.choices?.[0]?.message?.content || '', citations: citationsFrom(r.data, max_results) };
    }
    return { ok: false, error: [firstError, `router search ${r.status}: ${r.error}`].filter(Boolean).join(' | ') };
  }

  return { ok: false, error: firstError || 'no search key configured (PERPLEXITY_API_KEY or OPENROUTER_API_KEY)' };
}
