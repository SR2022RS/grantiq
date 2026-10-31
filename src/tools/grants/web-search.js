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

  // Fallback 1: the same Sonar search model through the LLM router account.
  const errors = firstError ? [firstError] : [];
  if (routerKey) {
    const r = await searchVia('https://openrouter.ai/api/v1/chat/completions', routerKey, 'perplexity/sonar', query, {
      'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://grantiq.operatorhq.agency',
      'X-Title': process.env.OPENROUTER_TITLE || 'GrantIQ Command Center',
    });
    if (r.ok) {
      if (errors.length) console.warn(`[web_search] ${errors.join(' | ')}; used router fallback`);
      return { ok: true, answer: r.data?.choices?.[0]?.message?.content || '', citations: citationsFrom(r.data, max_results) };
    }
    errors.push(`router search ${r.status}: ${r.error}`);
  }

  // Fallback 2: the LLM provider's own server-side web search tool.
  if (process.env.ANTHROPIC_API_KEY) {
    const r = await anthropicWebSearch(query, max_results);
    if (r.ok) {
      if (errors.length) console.warn(`[web_search] ${errors.join(' | ')}; used direct web search fallback`);
      return r;
    }
    errors.push(r.error);
  }

  return { ok: false, error: errors.join(' | ') || 'no search key configured' };
}

async function anthropicWebSearch(query, maxResults) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GRANTIQ_SEARCH_MODEL || 'claude-haiku-4-5',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{
          role: 'user',
          content: `Search the web and answer concisely with specifics (names, funders, amounts, deadlines, URLs):\n\n${query}`,
        }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `direct web search ${res.status}: ${t.slice(0, 200)}` };
    }
    const data = await res.json();
    const blocks = data?.content || [];
    const answer = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const urls = [];
    for (const b of blocks) {
      for (const c of b.citations || []) if (c.url) urls.push(c.url);
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content) if (r.url) urls.push(r.url);
      }
    }
    return { ok: true, answer, citations: [...new Set(urls)].slice(0, maxResults) };
  } catch (e) {
    return { ok: false, error: `direct web search: ${e?.message || e}` };
  }
}
