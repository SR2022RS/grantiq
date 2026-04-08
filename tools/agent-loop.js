// ============================================
// AGENTIC LOOP — Core engine for all sub-agents
// ============================================
// Same pattern as AdWhisperer's agent loop:
//   1. Claude receives the task + tools
//   2. Claude decides which tool to call (or responds directly)
//   3. Tool is executed, result fed back to Claude
//   4. Repeat until Claude gives a final answer
//   5. Return the final answer + action log

const { callLLM } = require('./llm');
const { executeTool, getToolsForAgent } = require('./composio-tools');

const MAX_ITERATIONS = 15;

/**
 * Run a sub-agent with tools until it completes its task.
 */
async function runAgent({ agentName, modelRole, systemPrompt, task, context = {} }) {
  const tools = getToolsForAgent(agentName);
  const actions = [];
  let iterations = 0;
  let modelUsed = '';

  const messages = [
    { role: 'user', content: `TASK: ${task}\n\nCONTEXT:\n${JSON.stringify(context, null, 2)}` },
  ];

  console.log(`[${agentName.toUpperCase()}] Starting agent loop — task: ${task.substring(0, 80)}...`);

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const llmStart = Date.now();
    const response = await callLLM(modelRole || agentName, systemPrompt, messages, tools);
    console.log(`[${agentName.toUpperCase()}] Iteration ${iterations} — ${Date.now() - llmStart}ms — stop: ${response.stop_reason}, tools: ${response.tool_calls?.length || 0}`);
    modelUsed = response.model_used;

    if (response.error) {
      console.error(`[${agentName.toUpperCase()}] LLM error:`, response.error);
      return { result: `Agent error: ${response.error}`, actions, iterations, model_used: modelUsed, error: response.error };
    }

    // No tool calls = agent is done
    if (!response.tool_calls || response.tool_calls.length === 0 || response.stop_reason === 'end_turn') {
      console.log(`[${agentName.toUpperCase()}] Completed in ${iterations} iterations. Actions: ${actions.length}`);
      return { result: response.content, actions, iterations, model_used: modelUsed };
    }

    // Process tool calls
    const assistantContent = [];
    if (response.content) assistantContent.push({ type: 'text', text: response.content });
    for (const tc of response.tool_calls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // Execute each tool and build results
    const toolResults = [];
    for (const tc of response.tool_calls) {
      console.log(`[${agentName.toUpperCase()}] Tool: ${tc.name}(${JSON.stringify(tc.input).substring(0, 100)})`);
      const toolStart = Date.now();

      let result;
      try {
        result = await executeTool(tc.name, tc.input);
      } catch (e) {
        result = { error: e.message };
      }

      const elapsed = Date.now() - toolStart;
      actions.push({ tool: tc.name, input: tc.input, result: typeof result === 'string' ? result : JSON.stringify(result).substring(0, 500), elapsed_ms: elapsed });

      // Truncate large results to avoid context overflow
      let resultStr = typeof result === 'string' ? result : JSON.stringify(result);
      if (resultStr.length > 5000) resultStr = resultStr.substring(0, 5000) + '... [truncated]';

      toolResults.push({ type: 'tool_result', tool_use_id: tc.id, content: resultStr });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  console.log(`[${agentName.toUpperCase()}] Hit max iterations (${MAX_ITERATIONS})`);
  return { result: 'Agent reached iteration limit.', actions, iterations, model_used: modelUsed, error: 'max_iterations' };
}

/**
 * Quick single-shot agent call (no tools, just reasoning).
 */
async function quickAgent({ agentName, modelRole, systemPrompt, task }) {
  const response = await callLLM(modelRole || agentName, systemPrompt, [
    { role: 'user', content: task },
  ]);
  return { result: response.content, model_used: response.model_used };
}

module.exports = { runAgent, quickAgent };
