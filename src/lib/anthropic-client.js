// =============================================================================
// GrantIQ — Anthropic SDK wrapper + tool-use loop
// =============================================================================
// Lifted from scout-vercel/src/agent/client.js with renamed factory.
// Single entry point: createGrantIQClient({ apiKey, dispatch }).run({ system, messages, tools })

import Anthropic from '@anthropic-ai/sdk';
import {
  MODEL,
  MAX_TOKENS,
  MAX_TOOL_ITERATIONS,
  RETRY_STATUSES,
  RETRY_BACKOFF_MS,
} from './constants.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err) {
  const status = err?.status ?? err?.response?.status;
  return status ? RETRY_STATUSES.has(status) : false;
}

async function callWithRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_BACKOFF_MS[attempt - 1]);
    try { return await fn(); }
    catch (err) { lastErr = err; if (!isRetryable(err)) throw err; }
  }
  throw lastErr;
}

export function createGrantIQClient({ apiKey = process.env.ANTHROPIC_API_KEY, dispatch } = {}) {
  if (!apiKey) throw new Error('[grantiq/client] ANTHROPIC_API_KEY missing');
  if (typeof dispatch !== 'function') {
    throw new Error('[grantiq/client] dispatch(name, input) callback required');
  }

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 120_000 });

  async function run({ system, messages, tools = [] }) {
    const startAll = Date.now();
    const telemetry = {
      iterations: 0,
      tokens_in: 0,
      tokens_out: 0,
      tokens_cache_read: 0,
      tokens_cache_write: 0,
      tools_invoked: [],
      latency_ms: 0,
    };

    const workingMessages = Array.isArray(messages) ? [...messages] : [];
    let finalText = '';
    let lastStopReason = null;

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      telemetry.iterations = iter + 1;

      const response = await callWithRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          tools,
          messages: workingMessages,
        })
      );

      const usage = response.usage || {};
      telemetry.tokens_in += usage.input_tokens || 0;
      telemetry.tokens_out += usage.output_tokens || 0;
      telemetry.tokens_cache_read += usage.cache_read_input_tokens || 0;
      telemetry.tokens_cache_write += usage.cache_creation_input_tokens || 0;

      workingMessages.push({ role: 'assistant', content: response.content });

      const textBlocks = response.content.filter((b) => b.type === 'text');
      finalText = textBlocks.map((b) => b.text).join('\n\n').trim();
      lastStopReason = response.stop_reason;

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        telemetry.latency_ms = Date.now() - startAll;
        return {
          text: finalText,
          messages: workingMessages,
          stop_reason: lastStopReason,
          telemetry,
          status: 'success',
        };
      }

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const t0 = Date.now();
          let ok = true;
          let out;
          let errMsg;
          try { out = await dispatch(block.name, block.input); }
          catch (e) {
            ok = false;
            errMsg = e?.message || String(e);
            out = { error: errMsg };
          }
          telemetry.tools_invoked.push({
            name: block.name,
            input: block.input,
            ok,
            latency_ms: Date.now() - t0,
            ...(errMsg ? { error: errMsg } : {}),
          });
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof out === 'string' ? out : JSON.stringify(out),
            is_error: !ok,
          };
        })
      );

      workingMessages.push({ role: 'user', content: toolResults });
    }

    telemetry.latency_ms = Date.now() - startAll;
    return {
      text: finalText || '(reached max tool iterations without a final answer)',
      messages: workingMessages,
      stop_reason: 'max_iterations',
      telemetry,
      status: 'partial',
    };
  }

  return { run };
}
