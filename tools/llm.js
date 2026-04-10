// ============================================
// LLM PROVIDER — OpenRouter (primary) + Claude (fallback)
// ============================================
// OpenRouter is the primary provider — routes all models.
// Anthropic direct is fallback if OpenRouter key not set.
// Cost optimization: Claude Sonnet for premium tasks,
// GPT-4o-mini for research, Gemini Flash for reports.

function getAnthropicKey() {
  return process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
}

function getOpenRouterKey() {
  return process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '';
}

const MODEL_CONFIG = {
  // All agents use cost-efficient models via OpenRouter
  'director':    { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'writer':      { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'applicator':  { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'finder':      { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'analyst':     { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'tracker':     { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'monitor':     { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'reporter':    { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'vault':       { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
  'budgetgen':   { openrouterModel: 'google/gemini-2.0-flash-001', anthropicModel: 'claude-sonnet-4-20250514' },
};

function resolveModel(agentRole) {
  const config = MODEL_CONFIG[agentRole] || MODEL_CONFIG['director'];
  const orKey = getOpenRouterKey();
  // OpenRouter is primary — use it if key is available
  if (orKey && config.openrouterModel) {
    return { provider: 'openrouter', model: config.openrouterModel };
  }
  // Fallback to Anthropic direct
  return { provider: 'anthropic', model: config.anthropicModel };
}

async function callLLM(agentRole, systemPrompt, messages, tools = [], maxTokens = 4096) {
  const { provider, model } = resolveModel(agentRole);
  console.log(`[LLM] ${agentRole} → ${provider}/${model}`);

  if (provider === 'openrouter') {
    return await callOpenRouter(model, systemPrompt, messages, tools, maxTokens);
  } else {
    return await callAnthropic(model, systemPrompt, messages, tools, maxTokens);
  }
}

async function callAnthropic(model, systemPrompt, messages, tools, maxTokens) {
  const apiKey = getAnthropicKey();
  if (!apiKey) return { content: '', tool_calls: [], stop_reason: 'error', error: 'ANTHROPIC_KEY not set', model_used: model };

  try {
    const body = { model, max_tokens: maxTokens, system: systemPrompt, messages };
    if (tools && tools.length > 0) body.tools = tools;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) return { content: '', tool_calls: [], stop_reason: 'error', error: data.error.message || data.error.type, model_used: model };

    let textContent = '';
    const toolCalls = [];
    if (data.content) {
      for (const block of data.content) {
        if (block.type === 'text') textContent += block.text;
        if (block.type === 'tool_use') toolCalls.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    return { content: textContent, tool_calls: toolCalls, stop_reason: data.stop_reason, model_used: model };
  } catch (e) {
    return { content: '', tool_calls: [], stop_reason: 'error', error: e.message, model_used: model };
  }
}

async function callOpenRouter(model, systemPrompt, messages, tools, maxTokens) {
  const apiKey = getOpenRouterKey();
  if (!apiKey) return callAnthropic('claude-sonnet-4-20250514', systemPrompt, messages, tools, maxTokens);

  try {
    // Convert Anthropic-format messages to OpenAI-format for OpenRouter
    const orMessages = [{ role: 'system', content: systemPrompt }];
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        orMessages.push({ role: msg.role, content: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            orMessages.push({ role: 'tool', tool_call_id: block.tool_use_id, content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content) });
          } else if (block.type === 'text') {
            orMessages.push({ role: msg.role, content: block.text });
          } else if (block.type === 'tool_use') {
            const last = orMessages[orMessages.length - 1];
            if (last && last.role === 'assistant' && last.tool_calls) {
              last.tool_calls.push({ id: block.id, type: 'function', function: { name: block.name, arguments: JSON.stringify(block.input) } });
            } else {
              orMessages.push({ role: 'assistant', content: '', tool_calls: [{ id: block.id, type: 'function', function: { name: block.name, arguments: JSON.stringify(block.input) } }] });
            }
          }
        }
      }
    }

    const body = { model, max_tokens: maxTokens, messages: orMessages };
    if (tools && tools.length > 0) {
      body.tools = tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    }

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://grantiq.app' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.error) return { content: '', tool_calls: [], stop_reason: 'error', error: data.error.message || JSON.stringify(data.error), model_used: model };

    const choice = data.choices?.[0];
    const toolCalls = (choice?.message?.tool_calls || []).map(tc => ({
      id: tc.id,
      name: tc.function.name,
      input: JSON.parse(tc.function.arguments || '{}'),
    }));

    return {
      content: choice?.message?.content || '',
      tool_calls: toolCalls,
      stop_reason: choice?.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
      model_used: model,
    };
  } catch (e) {
    console.error('[OpenRouter] Error, falling back to Anthropic:', e.message);
    return callAnthropic('claude-sonnet-4-20250514', systemPrompt, messages, tools, maxTokens);
  }
}

module.exports = { callLLM, resolveModel };
