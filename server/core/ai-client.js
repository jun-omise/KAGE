/**
 * KAGE Unified AI Client
 * Supports Anthropic (native), OpenAI-compatible (OpenAI, Groq, xAI, Alibaba, Moonshot, OpenRouter), and Google Gemini.
 */
import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db/init.js';
import { MODEL_PROVIDERS, getModelById, getProviderForModel } from './model-registry.js';

class AIClient {
  constructor() {
    this._clients = {}; // provider -> client instance
    this._activeModel = 'claude-sonnet-4-20250514'; // default
    this._loadActiveModel();
  }

  _loadActiveModel() {
    try {
      const db = getDb();
      const row = db.prepare("SELECT value FROM config WHERE key = 'active_model'").get();
      if (row) this._activeModel = row.value;
    } catch {}
  }

  get activeModel() {
    return this._activeModel;
  }

  setActiveModel(modelId) {
    const model = getModelById(modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);
    this._activeModel = modelId;
    try {
      const db = getDb();
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('active_model', ?)").run(modelId);
    } catch {}
  }

  /**
   * Get API key for a provider (env → DB fallback)
   */
  _getApiKey(providerId) {
    const provider = MODEL_PROVIDERS[providerId];
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);

    let apiKey = process.env[provider.envKey];
    if (!apiKey) {
      try {
        const db = getDb();
        const row = db.prepare("SELECT value FROM config WHERE key = ?").get(provider.dbConfigKey);
        if (row) apiKey = row.value;
      } catch {}
    }
    return apiKey || null;
  }

  /**
   * Get or create Anthropic client
   */
  _getAnthropicClient() {
    if (this._clients.anthropic) return this._clients.anthropic;
    const apiKey = this._getApiKey('anthropic');
    if (!apiKey) throw new Error('Anthropic API key not configured');
    this._clients.anthropic = new Anthropic({ apiKey });
    return this._clients.anthropic;
  }

  /**
   * Generic OpenAI-compatible fetch
   */
  async _openaiChat(providerId, modelId, messages, { systemPrompt, maxTokens = 4096 }) {
    const apiKey = this._getApiKey(providerId);
    if (!apiKey) throw new Error(`${MODEL_PROVIDERS[providerId].name} API key not configured`);

    const provider = MODEL_PROVIDERS[providerId];
    const body = {
      model: modelId,
      max_tokens: maxTokens,
      messages: [],
    };

    if (systemPrompt) {
      body.messages.push({ role: 'system', content: systemPrompt });
    }
    body.messages.push(...messages);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // OpenRouter needs extra headers
    if (providerId === 'openrouter') {
      headers['HTTP-Referer'] = 'https://kage.local';
      headers['X-Title'] = 'KAGE';
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${provider.name} API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const usage = data.usage || {};

    return {
      content: [{ type: 'text', text }],
      usage: {
        input_tokens: usage.prompt_tokens || 0,
        output_tokens: usage.completion_tokens || 0,
      },
    };
  }

  /**
   * Google Gemini API
   */
  async _geminiChat(modelId, messages, { systemPrompt, maxTokens = 4096 }) {
    const apiKey = this._getApiKey('google');
    if (!apiKey) throw new Error('Google API key not configured');

    const contents = [];
    if (systemPrompt) {
      contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
      contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
    }
    for (const msg of messages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: maxTokens },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google Gemini API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};

    return {
      content: [{ type: 'text', text }],
      usage: {
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0,
      },
    };
  }

  /**
   * Stream chat response — yields text chunks via callback
   * Falls back to non-streaming for providers that don't support it easily
   */
  async chatStream(messages, { systemPrompt, maxTokens = 4096, model, onChunk } = {}) {
    const modelId = model || this._activeModel;
    const modelInfo = getModelById(modelId);
    if (!modelInfo) throw new Error(`Unknown model: ${modelId}`);

    const provider = MODEL_PROVIDERS[modelInfo.provider];

    if (provider.apiFormat === 'anthropic') {
      const client = this._getAnthropicClient();
      const params = { model: modelId, max_tokens: maxTokens, messages };
      if (systemPrompt) params.system = systemPrompt;

      const stream = client.messages.stream(params);
      let fullText = '';

      stream.on('text', (text) => {
        fullText += text;
        if (onChunk) onChunk(text);
      });

      const finalMessage = await stream.finalMessage();
      const usage = finalMessage.usage || null;
      return { response: fullText, usage };
    }

    if (provider.apiFormat === 'openai') {
      // OpenAI-compatible streaming
      const apiKey = this._getApiKey(modelInfo.provider);
      if (!apiKey) throw new Error(`${provider.name} API key not configured`);

      const body = {
        model: modelId,
        max_tokens: maxTokens,
        messages: [],
        stream: true,
      };
      if (systemPrompt) body.messages.push({ role: 'system', content: systemPrompt });
      body.messages.push(...messages);

      const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
      if (modelInfo.provider === 'openrouter') {
        headers['HTTP-Referer'] = 'https://kage.local';
        headers['X-Title'] = 'KAGE';
      }

      const res = await fetch(`${provider.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${provider.name} API error (${res.status}): ${err}`);
      }

      let fullText = '';
      let usage = null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const data = JSON.parse(payload);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              if (onChunk) onChunk(delta);
            }
            if (data.usage) {
              usage = { input_tokens: data.usage.prompt_tokens || 0, output_tokens: data.usage.completion_tokens || 0 };
            }
          } catch {}
        }
      }

      // Estimate usage if not provided
      if (!usage) usage = { input_tokens: 0, output_tokens: 0 };
      return { response: fullText, usage };
    }

    // Fallback: non-streaming, emit full response as single chunk
    const result = await this.chat(messages, { systemPrompt, maxTokens, model });
    const text = result.content.find(c => c.type === 'text')?.text || '';
    if (onChunk) onChunk(text);
    return { response: text, usage: result.usage || null };
  }

  /**
   * Unified chat interface — routes to the correct provider
   */
  async chat(messages, { systemPrompt, tools, stream = false, maxTokens = 4096, model } = {}) {
    const modelId = model || this._activeModel;
    const modelInfo = getModelById(modelId);

    if (!modelInfo) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const provider = MODEL_PROVIDERS[modelInfo.provider];

    switch (provider.apiFormat) {
      case 'anthropic': {
        const client = this._getAnthropicClient();
        const params = {
          model: modelId,
          max_tokens: maxTokens,
          messages,
        };
        if (systemPrompt) params.system = systemPrompt;
        if (tools?.length) params.tools = tools;
        if (stream) return client.messages.stream(params);
        return client.messages.create(params);
      }

      case 'openai':
        return this._openaiChat(modelInfo.provider, modelId, messages, { systemPrompt, maxTokens });

      case 'google':
        return this._geminiChat(modelId, messages, { systemPrompt, maxTokens });

      default:
        throw new Error(`Unsupported API format: ${provider.apiFormat}`);
    }
  }

  /**
   * Run an agent call (expects JSON response)
   */
  async runAgent(agentConfig, input, { model, maxTokens } = {}) {
    const messages = [{ role: 'user', content: JSON.stringify(input) }];

    // Executor needs much higher token limits for generating SVG/HTML content
    const defaultMaxTokens = agentConfig.role === 'executor' ? 16384 : 4096;

    const response = await this.chat(messages, {
      systemPrompt: agentConfig.systemPrompt,
      maxTokens: maxTokens || defaultMaxTokens,
      model,
    });

    const textContent = response.content.find(c => c.type === 'text');
    const text = textContent?.text || '';

    // Extract usage data from the response
    const usage = response.usage || null;

    // Try to parse JSON from the response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return { result, usage };
      }
    } catch {
      // If JSON parsing failed, try to find the outermost balanced JSON object
      try {
        const result = this._extractBalancedJson(text);
        if (result) return { result, usage };
      } catch {}
    }

    return { result: { raw: text }, usage };
  }

  /**
   * Extract the outermost balanced JSON object from text.
   * More robust than simple regex when response contains nested braces (e.g., SVG in JSON).
   */
  _extractBalancedJson(text) {
    const firstBrace = text.indexOf('{');
    if (firstBrace === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"' && !escape) { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          const candidate = text.slice(firstBrace, i + 1);
          return JSON.parse(candidate);
        }
      }
    }
    return null;
  }

  /**
   * Check which providers have API keys configured
   */
  getConfiguredProviders() {
    const result = {};
    for (const [id, provider] of Object.entries(MODEL_PROVIDERS)) {
      const key = this._getApiKey(id);
      result[id] = {
        ...provider,
        configured: !!key,
        keyPreview: key ? `${key.substring(0, 8)}...` : null,
      };
    }
    return result;
  }

  /**
   * Reset cached client for a provider
   */
  resetProvider(providerId) {
    delete this._clients[providerId];
  }

  resetAll() {
    this._clients = {};
  }
}

// Singleton
const aiClient = new AIClient();
export default aiClient;
