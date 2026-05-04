export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
export const MAX_TOKENS = parseInt(process.env.GRANTIQ_MAX_TOKENS || '4096', 10);
export const MAX_TOOL_ITERATIONS = parseInt(process.env.GRANTIQ_MAX_TOOL_ITERATIONS || '8', 10);

export const RETRY_STATUSES = new Set([429, 529, 500, 502, 503, 504]);
export const RETRY_BACKOFF_MS = [1000, 2000, 4000];

export const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export function assertRequiredEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`[grantiq] missing required env vars: ${missing.join(', ')}`);
  }
}

export const CONVERSATION_SUMMARIZATION_THRESHOLD_TOKENS = 100_000;
