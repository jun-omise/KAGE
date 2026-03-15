/**
 * KAGE Model Router
 * Automatically selects the optimal model for each agent role based on
 * task complexity and user's configured main model provider.
 */

import { MODEL_CATALOG, MODEL_PROVIDERS, getModelById } from './model-registry.js';

/**
 * Classify the complexity of a user message.
 * @param {string} message - The user's input message
 * @returns {'simple'|'moderate'|'complex'}
 */
export function classifyComplexity(message) {
  if (!message || typeof message !== 'string') return 'simple';

  const len = message.length;
  const lines = message.split('\n').filter(l => l.trim()).length;

  // Complex indicators
  const complexPatterns = [
    /\d+\.\s+/g,                    // numbered lists
    /[-*]\s+.+\n[-*]\s+/g,         // bullet lists (multi-item)
    /ステップ|手順|フェーズ|段階/g,   // Japanese: steps/phases
    /step|phase|stage|workflow/gi,   // English: steps/phases
    /分析して.*作成|調査して.*まとめ/g, // Japanese: multi-action
    /analyze.*create|research.*summarize/gi, // English: multi-action
    /```[\s\S]*?```/g,              // code blocks
    /https?:\/\//g,                 // URLs (multiple data sources)
  ];

  let complexScore = 0;

  // Length-based scoring
  if (len > 500) complexScore += 2;
  else if (len > 200) complexScore += 1;

  // Line count scoring
  if (lines > 10) complexScore += 2;
  else if (lines > 5) complexScore += 1;

  // Pattern matching
  for (const pattern of complexPatterns) {
    const matches = message.match(pattern);
    if (matches) {
      complexScore += matches.length >= 3 ? 2 : 1;
    }
  }

  // Tool-requiring keywords (Japanese + English)
  const toolKeywords = [
    /ファイル|フォルダ|ディレクトリ/gi,
    /file|folder|directory/gi,
    /検索|サーチ|ブラウズ/gi,
    /search|browse|fetch/gi,
    /データベース|DB|SQL/gi,
    /GitHub|リポジトリ|repository/gi,
    /API|エンドポイント|endpoint/gi,
  ];

  let toolCount = 0;
  for (const kw of toolKeywords) {
    if (kw.test(message)) toolCount++;
  }
  if (toolCount >= 3) complexScore += 2;
  else if (toolCount >= 1) complexScore += 1;

  if (complexScore >= 4) return 'complex';
  if (complexScore >= 2) return 'moderate';
  return 'simple';
}

/**
 * Agent role → model tier mapping rules:
 * - sentinel: Always fast (security check, lightweight)
 * - reviewer: Always fast (output validation, lightweight)
 * - planner: Scales with complexity
 * - executor: Always uses user's main model
 * - final_response: Always balanced
 */
const AGENT_TIER_MAP = {
  sentinel: { simple: 'fast', moderate: 'fast', complex: 'fast' },
  reviewer: { simple: 'fast', moderate: 'fast', complex: 'fast' },
  planner:  { simple: 'balanced', moderate: 'balanced', complex: 'flagship' },
  executor: { simple: 'main', moderate: 'main', complex: 'main' },
  final_response: { simple: 'balanced', moderate: 'balanced', complex: 'balanced' },
};

/**
 * Get the cheapest model for a given tier, optionally within the same provider.
 * @param {string} tier - 'fast', 'balanced', or 'flagship'
 * @param {string} [preferredProviderId] - If specified, prefer models from this provider
 * @returns {object|null} Model catalog entry
 */
export function getCheapestModelForTier(tier, preferredProviderId) {
  const candidates = MODEL_CATALOG.filter(m => m.tier === tier && m.id !== 'openrouter/auto');

  if (candidates.length === 0) return null;

  // Sort by total cost (input + output, weighted toward output which is typically more)
  const sorted = candidates.sort((a, b) => {
    const costA = a.inputCost + a.outputCost * 2;
    const costB = b.inputCost + b.outputCost * 2;
    return costA - costB;
  });

  // If preferred provider specified, try same-provider first
  if (preferredProviderId) {
    const sameProvider = sorted.find(m => m.provider === preferredProviderId);
    if (sameProvider) return sameProvider;
  }

  return sorted[0];
}

/**
 * Determine the best model for a given agent role and complexity.
 * @param {string} agentRole - 'sentinel'|'planner'|'executor'|'reviewer'|'final_response'
 * @param {string} complexity - 'simple'|'moderate'|'complex'
 * @param {string} mainModelId - The user's selected main model ID
 * @returns {string} Model ID to use
 */
export function getModelForAgent(agentRole, complexity, mainModelId) {
  const tierMap = AGENT_TIER_MAP[agentRole];
  if (!tierMap) return mainModelId; // fallback

  const requiredTier = tierMap[complexity] || 'balanced';

  // Executor always uses the user's main model
  if (requiredTier === 'main') {
    return mainModelId;
  }

  // Determine preferred provider from the main model
  const mainModel = getModelById(mainModelId);
  const preferredProvider = mainModel?.provider || 'anthropic';

  // Find cheapest model in the required tier, preferring same provider
  const cheapest = getCheapestModelForTier(requiredTier, preferredProvider);
  if (cheapest) return cheapest.id;

  // Ultimate fallback: use main model
  return mainModelId;
}

/**
 * Get the full routing plan for all agents given a complexity level.
 * Useful for displaying in the UI / agent monitor.
 * @param {string} complexity - 'simple'|'moderate'|'complex'
 * @param {string} mainModelId - The user's selected main model ID
 * @returns {Object} Mapping of agentRole → { modelId, modelName, tier }
 */
export function getRoutingPlan(complexity, mainModelId) {
  const roles = ['sentinel', 'planner', 'executor', 'reviewer', 'final_response'];
  const plan = {};

  for (const role of roles) {
    const modelId = getModelForAgent(role, complexity, mainModelId);
    const model = getModelById(modelId);
    plan[role] = {
      modelId,
      modelName: model?.name || modelId,
      tier: model?.tier || 'unknown',
      inputCost: model?.inputCost || 0,
      outputCost: model?.outputCost || 0,
    };
  }

  return plan;
}
