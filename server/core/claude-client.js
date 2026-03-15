import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../db/init.js';

class ClaudeClient {
  constructor() {
    this.model = 'claude-sonnet-4-20250514';
    this._client = null;
  }

  getClient() {
    if (this._client) return this._client;
    // Try env first, then DB config
    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      try {
        const db = getDb();
        const row = db.prepare("SELECT value FROM config WHERE key = 'api_key'").get();
        if (row) apiKey = row.value;
      } catch {}
    }
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured. Please set it in .env or complete the setup wizard.');
    }
    this._client = new Anthropic({ apiKey });
    return this._client;
  }

  resetClient() {
    this._client = null;
  }

  async chat(messages, { systemPrompt, tools, stream = false, maxTokens = 4096 } = {}) {
    const client = this.getClient();
    const params = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    };
    if (systemPrompt) params.system = systemPrompt;
    if (tools?.length) params.tools = tools;

    if (stream) {
      return client.messages.stream(params);
    }
    return client.messages.create(params);
  }

  async runAgent(agentConfig, input) {
    const messages = [{ role: 'user', content: JSON.stringify(input) }];
    const response = await this.chat(messages, {
      systemPrompt: agentConfig.systemPrompt,
      maxTokens: 2048,
    });

    const textContent = response.content.find(c => c.type === 'text');
    const text = textContent?.text || '';

    // Try to parse JSON response
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}

    return { raw: text };
  }
}

export default ClaudeClient;
