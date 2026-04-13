import Anthropic from '@anthropic-ai/sdk';
import { RetryError } from './errors.js';
import { resolveModel, DEFAULT_MODEL } from './models.js';

/**
 * Thin wrapper around the Anthropic SDK that adds:
 *  - retry with exponential backoff on 429/5xx/network errors
 *  - prompt caching (cache_control breakpoints) for system prompt and tool defs
 *  - streaming helpers that emit normalized events
 */
export class AnthropicClient {
  constructor({ apiKey, baseURL, defaultModel = DEFAULT_MODEL, logger } = {}) {
    if (!apiKey) throw new Error('AnthropicClient requires an apiKey');
    this.sdk = new Anthropic({ apiKey, baseURL });
    this.defaultModel = defaultModel;
    this.logger = logger || console;
  }

  _sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async _withRetry(fn, { retries = 4, baseDelay = 500 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const status = err?.status || err?.response?.status;
        const retriable = !status || status === 429 || (status >= 500 && status < 600);
        if (!retriable || attempt === retries) break;
        const delay = baseDelay * 2 ** attempt + Math.floor(Math.random() * 250);
        this.logger.warn?.(`Anthropic request failed (attempt ${attempt + 1}/${retries}): ${err.message}. Retrying in ${delay}ms`);
        await this._sleep(delay);
      }
    }
    throw new RetryError(`Anthropic request exhausted retries: ${lastErr?.message}`, { cause: lastErr, attempts: retries + 1 });
  }

  _prepareMessages(messages) {
    // Apply prompt caching breakpoints on the last 2 user messages for multi-turn efficiency.
    const msgs = messages.map((m) => ({ ...m }));
    const userIdx = msgs.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0).slice(-2);
    for (const i of userIdx) {
      const m = msgs[i];
      if (typeof m.content === 'string') {
        m.content = [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }];
      } else if (Array.isArray(m.content) && m.content.length) {
        m.content = m.content.map((b, idx) => idx === m.content.length - 1 && b.type === 'text' ? { ...b, cache_control: { type: 'ephemeral' } } : b);
      }
    }
    return msgs;
  }

  async complete({ model, system, messages, tools, toolChoice, maxTokens = 8192, temperature = 0.7, thinking } = {}) {
    const resolvedModel = resolveModel(model || this.defaultModel).id;
    const systemBlocks = system
      ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
      : undefined;
    const preparedTools = tools?.length
      ? tools.map((t, idx) => (idx === tools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t))
      : undefined;
    return this._withRetry(() => this.sdk.messages.create({
      model: resolvedModel,
      max_tokens: maxTokens,
      temperature,
      system: systemBlocks,
      messages: this._prepareMessages(messages),
      tools: preparedTools,
      tool_choice: toolChoice,
      thinking
    }));
  }

  /**
   * Streaming complete. Yields normalized events:
   *   { type: 'text', delta }
   *   { type: 'tool_use_start', id, name, input }
   *   { type: 'tool_use_delta', id, partial_json }
   *   { type: 'message_stop', usage, stopReason }
   */
  async *stream({ model, system, messages, tools, toolChoice, maxTokens = 8192, temperature = 0.7, thinking } = {}) {
    const resolvedModel = resolveModel(model || this.defaultModel).id;
    const systemBlocks = system ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : undefined;
    const preparedTools = tools?.length
      ? tools.map((t, idx) => (idx === tools.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t))
      : undefined;
    const response = await this._withRetry(() => this.sdk.messages.stream({
      model: resolvedModel,
      max_tokens: maxTokens,
      temperature,
      system: systemBlocks,
      messages: this._prepareMessages(messages),
      tools: preparedTools,
      tool_choice: toolChoice,
      thinking
    }));
    let currentTool = null;
    for await (const event of response) {
      switch (event.type) {
        case 'content_block_start': {
          if (event.content_block?.type === 'tool_use') {
            currentTool = { id: event.content_block.id, name: event.content_block.name, buffer: '' };
            yield { type: 'tool_use_start', id: currentTool.id, name: currentTool.name };
          } else if (event.content_block?.type === 'thinking') {
            yield { type: 'thinking_start' };
          }
          break;
        }
        case 'content_block_delta': {
          if (event.delta?.type === 'text_delta') yield { type: 'text', delta: event.delta.text };
          else if (event.delta?.type === 'input_json_delta' && currentTool) {
            currentTool.buffer += event.delta.partial_json;
            yield { type: 'tool_use_delta', id: currentTool.id, partial_json: event.delta.partial_json };
          } else if (event.delta?.type === 'thinking_delta') yield { type: 'thinking', delta: event.delta.thinking };
          break;
        }
        case 'content_block_stop': {
          if (currentTool) {
            let input = {};
            try { input = currentTool.buffer ? JSON.parse(currentTool.buffer) : {}; } catch { input = { _raw: currentTool.buffer }; }
            yield { type: 'tool_use_end', id: currentTool.id, name: currentTool.name, input };
            currentTool = null;
          }
          break;
        }
        default: break;
      }
    }
    const final = await response.finalMessage();
    yield { type: 'message_stop', usage: final.usage, stopReason: final.stop_reason, message: final };
  }
}

export function createClient(opts) { return new AnthropicClient(opts); }
