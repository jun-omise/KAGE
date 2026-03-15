/**
 * KAGE Token Tracker
 * Records real token usage from API responses and calculates actual costs.
 */

import { getModelById } from './model-registry.js';

export class TokenTracker {
  constructor() {
    /** @type {Array<{agentRole: string, modelId: string, inputTokens: number, outputTokens: number, cost: number, timestamp: number}>} */
    this.records = [];
  }

  /**
   * Record token usage from an API response.
   * @param {string} agentRole - 'sentinel'|'planner'|'executor'|'reviewer'|'final_response'
   * @param {string} modelId - The model ID used
   * @param {{ input_tokens?: number, output_tokens?: number, prompt_tokens?: number, completion_tokens?: number }} usage - API usage data
   */
  record(agentRole, modelId, usage) {
    if (!usage) return;

    // Normalize field names (Anthropic vs OpenAI format)
    const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
    const outputTokens = usage.output_tokens || usage.completion_tokens || 0;

    const cost = this.calculateCost(modelId, inputTokens, outputTokens);

    this.records.push({
      agentRole,
      modelId,
      inputTokens,
      outputTokens,
      cost,
      timestamp: Date.now(),
    });
  }

  /**
   * Calculate cost for a specific model and token counts.
   * Costs in MODEL_CATALOG are per million tokens.
   * @param {string} modelId
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @returns {number} Cost in USD
   */
  calculateCost(modelId, inputTokens, outputTokens) {
    const model = getModelById(modelId);
    if (!model) return 0;

    const inputCost = (inputTokens / 1_000_000) * model.inputCost;
    const outputCost = (outputTokens / 1_000_000) * model.outputCost;

    return inputCost + outputCost;
  }

  /**
   * Get the total session cost and breakdown.
   * @returns {{ totalInputTokens: number, totalOutputTokens: number, totalCost: number, breakdown: Array }}
   */
  getSessionTotal() {
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    for (const r of this.records) {
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;
      totalCost += r.cost;
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      breakdown: [...this.records],
    };
  }

  /**
   * Get cost for a specific agent role.
   * @param {string} agentRole
   * @returns {{ inputTokens: number, outputTokens: number, cost: number }}
   */
  getAgentCost(agentRole) {
    const agentRecords = this.records.filter(r => r.agentRole === agentRole);
    let inputTokens = 0;
    let outputTokens = 0;
    let cost = 0;

    for (const r of agentRecords) {
      inputTokens += r.inputTokens;
      outputTokens += r.outputTokens;
      cost += r.cost;
    }

    return { inputTokens, outputTokens, cost };
  }

  /**
   * Reset tracker for a new session.
   */
  reset() {
    this.records = [];
  }
}
