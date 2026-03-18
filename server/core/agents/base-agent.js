/**
 * BaseAgent — shared base class for all KAGE agents.
 * Provides common timeout management, event emission, and token tracking.
 */
import eventBus from '../event-bus.js';

const DEFAULT_TIMEOUT_MS = 30000; // 30s per agent

export class BaseAgent {
  constructor(name, emoji, aiClient) {
    this.name = name;
    this.emoji = emoji;
    this.ai = aiClient;
  }

  /**
   * Get system prompt — override in subclass
   */
  getSystemPrompt() {
    throw new Error('Subclass must implement getSystemPrompt()');
  }

  /**
   * Emit an event to the event bus
   */
  emit(eventType, data) {
    eventBus.emit(eventType, { agent: this.name, ...data });
  }

  /**
   * Run an AI call with timeout enforcement
   */
  async runWithTimeout(config, input, options = {}) {
    const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;
    const startTime = Date.now();

    this.emit('agent:start', { action: options.action || 'Processing...' });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Agent ${this.name} timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      const result = await Promise.race([
        this.ai.runAgent(config, input, {
          model: options.model,
          maxTokens: options.maxTokens,
        }),
        timeoutPromise,
      ]);

      const durationMs = Date.now() - startTime;
      this.emit('agent:complete', { result: 'success', duration_ms: durationMs });
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.emit('agent:error', { error: error.message, duration_ms: durationMs });
      throw error;
    }
  }
}
