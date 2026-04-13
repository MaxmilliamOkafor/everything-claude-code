import { toolsAsAnthropicSchema, runTool } from './tools/index.js';
import { createLogger } from './logger.js';

const DEFAULT_SYSTEM = `You are Claude, operating inside the Claude Ecosystem (Claude Code + Claude Cowork + Browser Extension).
You have access to tools for reading/writing files, executing shell commands, searching the codebase, browsing the web, and persisting memory.

Guidelines:
- Prefer decisive, minimal action. Use tools when concrete information is required.
- When editing code, read the file first, make the smallest correct change, and verify.
- When browsing, extract the relevant facts and cite the URL.
- Never fabricate file contents or command output. If a tool fails, explain why and try a safer alternative.
- Respect workspace scope; do not modify files outside the workspace unless asked.
- Be concise in final answers. Show work only when it helps the user act.`;

export class Agent {
  constructor({ client, model, tools, systemPrompt = DEFAULT_SYSTEM, maxSteps = 24, cwd = process.cwd(), onEvent, logger } = {}) {
    if (!client) throw new Error('Agent requires a client');
    this.client = client;
    this.model = model;
    this.tools = tools; // { [toolName]: true/false } mask
    this.systemPrompt = systemPrompt;
    this.maxSteps = maxSteps;
    this.cwd = cwd;
    this.onEvent = onEvent || (() => {});
    this.logger = logger || createLogger('agent');
  }

  _schema() { return toolsAsAnthropicSchema(this.tools); }

  /**
   * Run the agent loop against a conversation history.
   * @param {Array} messages - prior messages, ending with the user's latest.
   * @returns {Promise<{messages, usage, stopReason}>}
   */
  async run(messages, { stream = false } = {}) {
    const convo = messages.map((m) => ({ ...m }));
    const toolDefs = this._schema();
    let usageTotal = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    let stopReason = null;

    for (let step = 0; step < this.maxSteps; step++) {
      this.onEvent({ type: 'step_start', step });
      let assistantText = '';
      const toolUses = [];
      let finalMessage = null;

      if (stream) {
        for await (const ev of this.client.stream({
          model: this.model,
          system: this.systemPrompt,
          messages: convo,
          tools: toolDefs
        })) {
          if (ev.type === 'text') { assistantText += ev.delta; this.onEvent({ type: 'text', delta: ev.delta }); }
          else if (ev.type === 'tool_use_end') { toolUses.push({ id: ev.id, name: ev.name, input: ev.input }); this.onEvent({ type: 'tool_call', name: ev.name, input: ev.input }); }
          else if (ev.type === 'thinking') this.onEvent({ type: 'thinking', delta: ev.delta });
          else if (ev.type === 'message_stop') { finalMessage = ev.message; stopReason = ev.stopReason; }
        }
      } else {
        const resp = await this.client.complete({
          model: this.model,
          system: this.systemPrompt,
          messages: convo,
          tools: toolDefs
        });
        finalMessage = resp;
        stopReason = resp.stop_reason;
        for (const block of resp.content || []) {
          if (block.type === 'text') { assistantText += block.text; this.onEvent({ type: 'text', delta: block.text }); }
          if (block.type === 'tool_use') { toolUses.push({ id: block.id, name: block.name, input: block.input }); this.onEvent({ type: 'tool_call', name: block.name, input: block.input }); }
        }
      }

      if (finalMessage?.usage) {
        for (const k of Object.keys(usageTotal)) usageTotal[k] += finalMessage.usage[k] || 0;
      }

      // Append assistant turn
      convo.push({ role: 'assistant', content: finalMessage?.content || [{ type: 'text', text: assistantText }] });

      if (stopReason !== 'tool_use' || !toolUses.length) {
        this.onEvent({ type: 'final', text: assistantText, stopReason });
        return { messages: convo, usage: usageTotal, stopReason, text: assistantText };
      }

      // Execute tools in parallel
      const results = await Promise.all(toolUses.map(async (tu) => {
        try {
          const out = await runTool(tu.name, tu.input, { cwd: this.cwd });
          this.onEvent({ type: 'tool_result', name: tu.name, output: out });
          return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 200000) };
        } catch (err) {
          this.onEvent({ type: 'tool_error', name: tu.name, error: err.message });
          return { type: 'tool_result', tool_use_id: tu.id, is_error: true, content: `Error: ${err.message}` };
        }
      }));
      convo.push({ role: 'user', content: results });
    }

    this.onEvent({ type: 'final', text: '(max steps reached)', stopReason: 'max_steps' });
    return { messages: convo, usage: usageTotal, stopReason: 'max_steps', text: '' };
  }
}

export async function runAgent(opts) {
  const agent = new Agent(opts);
  return agent.run(opts.messages || [], { stream: opts.stream });
}
