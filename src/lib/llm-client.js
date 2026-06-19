// =============================================================================
// GrantIQ — Centralized LLM client factory
// =============================================================================
// One place to construct the Anthropic SDK so we can route via OpenRouter when
// OPENROUTER_API_KEY is set, with Anthropic-direct as automatic fallback.
//
// OpenRouter exposes an Anthropic-Messages-API-compatible endpoint at
// https://openrouter.ai/api/v1/anthropic — drop-in compatible with the SDK's
// messages.create() interface (tool use, system, caching all unchanged), so
// every existing call site keeps working with just a baseURL swap.

import Anthropic from '@anthropic-ai/sdk';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/**
 * Return a configured Anthropic SDK client.
 * Priority: OPENROUTER_API_KEY → ANTHROPIC_API_KEY → throw.
 */
export function makeLLMClient(opts = {}) {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (openrouterKey) {
    return new Anthropic({
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
  }

  if (anthropicKey) {
    return new Anthropic({
      apiKey: anthropicKey,
      maxRetries: opts.maxRetries ?? 0,
      timeout: opts.timeout ?? 120_000,
      ...opts,
    });
  }

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
