// =============================================================================
// GrantIQ — Centralized LLM client factory
// =============================================================================
// One place to construct the Anthropic SDK so we can route via OpenRouter when
// OPENROUTER_API_KEY is set, with Anthropic-direct as automatic fallback.
//
// OpenRouter exposes an Anthropic-Messages-API-compatible endpoint at
// https://openrouter.ai/api/v1/messages — drop-in compatible with the SDK's
// messages.create() interface (tool use, system, caching all unchanged), so
// every existing call site keeps working with just a baseURL swap.

import Anthropic from '@anthropic-ai/sdk';

// The SDK appends `/v1/messages` to baseURL, so the base must stop at `/api`.
// (Using `/api/v1` here produced `/api/v1/v1/messages`, a 404 on every call.)
export const OPENROUTER_BASE = 'https://openrouter.ai/api';

// Router errors that mean "this route can't serve the request" rather than
// "try again later": bad/expired key, out of credit, forbidden, wrong path.
const FALLBACK_STATUSES = new Set([401, 402, 403, 404]);

/** 'anthropic/claude-sonnet-4-6' -> 'claude-sonnet-4-6' (Anthropic-direct IDs). */
export function bareModelId(model) {
  if (typeof model !== 'string') return model;
  return model.startsWith('anthropic/') ? model.slice('anthropic/'.length) : model;
}

/**
 * Return a configured Anthropic SDK client.
 * Priority: OPENROUTER_API_KEY (with Anthropic-direct fallback when
 * ANTHROPIC_API_KEY is also set) → ANTHROPIC_API_KEY → throw.
 */
export function makeLLMClient(opts = {}) {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const direct = anthropicKey
    ? new Anthropic({
        apiKey: anthropicKey,
        maxRetries: opts.maxRetries ?? 0,
        timeout: opts.timeout ?? 120_000,
        ...opts,
      })
    : null;

  if (openrouterKey) {
    const router = new Anthropic({
      apiKey: openrouterKey,
      baseURL: OPENROUTER_BASE,
      defaultHeaders: {
        // OpenRouter optional attribution headers (shown on the dashboard for
        // analytics; do not affect routing or pricing).
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://grantiq.operatorhq.agency',
        'X-Title': process.env.OPENROUTER_TITLE || 'GrantIQ Command Center',
      },
      maxRetries: opts.maxRetries ?? 0,
      timeout: opts.timeout ?? 120_000,
      ...opts,
    });
    if (!direct) return router;

    // Runtime fallback: if the router answers with an auth / billing / routing
    // error, retry the same request once on Anthropic-direct with the bare
    // model ID. Transient errors (429/5xx) are left to the caller's retry loop.
    return {
      messages: {
        create: async (params, reqOpts) => {
          try {
            return await router.messages.create(params, reqOpts);
          } catch (err) {
            const status = err?.status ?? err?.response?.status;
            if (!FALLBACK_STATUSES.has(status)) throw err;
            console.warn(`[llm] OpenRouter returned ${status}; falling back to Anthropic-direct`);
            return direct.messages.create({ ...params, model: bareModelId(params.model) }, reqOpts);
          }
        },
      },
    };
  }

  if (direct) return direct;

  throw new Error(
    '[llm] No API key configured — set OPENROUTER_API_KEY (preferred) or ANTHROPIC_API_KEY'
  );
}

/** "openrouter" | "anthropic" | "none" — for diagnostics + /api/health. */
export function activeProvider() {
  if (process.env.OPENROUTER_API_KEY) return 'openrouter';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'none';
}

/**
 * When routing via OpenRouter, model IDs are namespaced as `vendor/model`.
 * Anthropic-direct accepts the plain ID. This normalizer adds the prefix only
 * when needed, so call sites can keep using the bare Anthropic model name.
 *
 *   modelId('claude-sonnet-4-6')             // OpenRouter on: 'anthropic/claude-sonnet-4-6'
 *   modelId('claude-sonnet-4-6')             // Anthropic on:  'claude-sonnet-4-6'
 *   modelId('anthropic/claude-sonnet-4-6')   // either:        'anthropic/claude-sonnet-4-6'
 */
export function modelId(base) {
  if (!base) return base;
  if (activeProvider() === 'openrouter' && !base.includes('/')) {
    return `anthropic/${base}`;
  }
  return base;
}
