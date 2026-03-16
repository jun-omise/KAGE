/**
 * KAGE Model Registry
 * Unified model definitions for all supported AI providers.
 * All providers use OpenAI-compatible API format except Anthropic.
 */

export const MODEL_PROVIDERS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    apiFormat: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    envKey: 'ANTHROPIC_API_KEY',
    dbConfigKey: 'api_key',
    docsUrl: 'https://console.anthropic.com/',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    apiFormat: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    dbConfigKey: 'openai_api_key',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  google: {
    id: 'google',
    name: 'Google',
    apiFormat: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    envKey: 'GOOGLE_API_KEY',
    dbConfigKey: 'google_api_key',
    docsUrl: 'https://aistudio.google.com/apikey',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    apiFormat: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    dbConfigKey: 'groq_api_key',
    docsUrl: 'https://console.groq.com/keys',
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    apiFormat: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    envKey: 'XAI_API_KEY',
    dbConfigKey: 'xai_api_key',
    docsUrl: 'https://console.x.ai/',
  },
  alibaba: {
    id: 'alibaba',
    name: 'Alibaba Cloud',
    apiFormat: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    envKey: 'DASHSCOPE_API_KEY',
    dbConfigKey: 'dashscope_api_key',
    docsUrl: 'https://dashscope.console.aliyun.com/',
  },
  moonshot: {
    id: 'moonshot',
    name: 'Moonshot AI',
    apiFormat: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    envKey: 'MOONSHOT_API_KEY',
    dbConfigKey: 'moonshot_api_key',
    docsUrl: 'https://platform.moonshot.cn/',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    apiFormat: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    dbConfigKey: 'openrouter_api_key',
    docsUrl: 'https://openrouter.ai/keys',
  },
};

export const MODEL_CATALOG = [
  // --- Anthropic (Latest: Claude 4.6, Feb 2026) ---
  { id: 'claude-opus-4-6', provider: 'anthropic', name: 'Claude Opus 4.6', tier: 'flagship', contextWindow: 1000000, inputCost: 15, outputCost: 75 },
  { id: 'claude-sonnet-4-6', provider: 'anthropic', name: 'Claude Sonnet 4.6', tier: 'balanced', contextWindow: 1000000, inputCost: 3, outputCost: 15 },
  { id: 'claude-sonnet-4-5-20250929', provider: 'anthropic', name: 'Claude Sonnet 4.5', tier: 'balanced', contextWindow: 200000, inputCost: 3, outputCost: 15 },
  { id: 'claude-3-5-haiku-20241022', provider: 'anthropic', name: 'Claude 3.5 Haiku', tier: 'fast', contextWindow: 200000, inputCost: 0.8, outputCost: 4 },
  { id: 'claude-sonnet-4-20250514', provider: 'anthropic', name: 'Claude Sonnet 4', tier: 'balanced', contextWindow: 200000, inputCost: 3, outputCost: 15 },
  { id: 'claude-opus-4-20250514', provider: 'anthropic', name: 'Claude Opus 4', tier: 'flagship', contextWindow: 200000, inputCost: 15, outputCost: 75 },

  // --- OpenAI (Latest: GPT-5, Aug 2025) ---
  { id: 'gpt-5', provider: 'openai', name: 'GPT-5', tier: 'flagship', contextWindow: 400000, inputCost: 5, outputCost: 20 },
  { id: 'gpt-5-mini', provider: 'openai', name: 'GPT-5 Mini', tier: 'balanced', contextWindow: 400000, inputCost: 1, outputCost: 4 },
  { id: 'gpt-4.1', provider: 'openai', name: 'GPT-4.1', tier: 'balanced', contextWindow: 1000000, inputCost: 2, outputCost: 8 },
  { id: 'gpt-4.1-mini', provider: 'openai', name: 'GPT-4.1 Mini', tier: 'fast', contextWindow: 1000000, inputCost: 0.4, outputCost: 1.6 },
  { id: 'gpt-4.1-nano', provider: 'openai', name: 'GPT-4.1 Nano', tier: 'fast', contextWindow: 1000000, inputCost: 0.1, outputCost: 0.4 },
  { id: 'o3', provider: 'openai', name: 'o3 (Reasoning)', tier: 'flagship', contextWindow: 200000, inputCost: 10, outputCost: 40 },
  { id: 'o3-pro', provider: 'openai', name: 'o3-pro (Reasoning)', tier: 'flagship', contextWindow: 200000, inputCost: 20, outputCost: 80 },
  { id: 'o4-mini', provider: 'openai', name: 'o4-mini (Reasoning)', tier: 'balanced', contextWindow: 200000, inputCost: 1.1, outputCost: 4.4 },

  // --- Google Gemini (Latest: Gemini 3.1 Pro, 2026) ---
  { id: 'gemini-3.1-pro-preview', provider: 'google', name: 'Gemini 3.1 Pro', tier: 'flagship', contextWindow: 1000000, inputCost: 1.25, outputCost: 10 },
  { id: 'gemini-2.5-pro', provider: 'google', name: 'Gemini 2.5 Pro', tier: 'flagship', contextWindow: 1048576, inputCost: 1.25, outputCost: 10 },
  { id: 'gemini-2.5-flash', provider: 'google', name: 'Gemini 2.5 Flash', tier: 'balanced', contextWindow: 1048576, inputCost: 0.15, outputCost: 0.6 },
  { id: 'gemini-2.5-flash-lite', provider: 'google', name: 'Gemini 2.5 Flash Lite', tier: 'fast', contextWindow: 1048576, inputCost: 0.075, outputCost: 0.3 },

  // --- Groq (Llama, etc.) ---
  { id: 'llama-3.3-70b-versatile', provider: 'groq', name: 'Llama 3.3 70B', tier: 'balanced', contextWindow: 128000, inputCost: 0.59, outputCost: 0.79 },
  { id: 'llama-3.1-8b-instant', provider: 'groq', name: 'Llama 3.1 8B', tier: 'fast', contextWindow: 128000, inputCost: 0.05, outputCost: 0.08 },
  { id: 'llama-4-scout-17b-16e-instruct', provider: 'groq', name: 'Llama 4 Scout 17B', tier: 'balanced', contextWindow: 131072, inputCost: 0.11, outputCost: 0.34 },
  { id: 'llama-4-maverick-17b-128e-instruct', provider: 'groq', name: 'Llama 4 Maverick 17B', tier: 'balanced', contextWindow: 131072, inputCost: 0.20, outputCost: 0.60 },
  { id: 'qwen-qwq-32b', provider: 'groq', name: 'Qwen QwQ 32B', tier: 'balanced', contextWindow: 131072, inputCost: 0.29, outputCost: 0.39 },
  { id: 'deepseek-r1-distill-llama-70b', provider: 'groq', name: 'DeepSeek R1 70B', tier: 'balanced', contextWindow: 131072, inputCost: 0.75, outputCost: 0.99 },

  // --- xAI Grok (Latest: Grok 4.20, 2026) ---
  { id: 'grok-4.20-beta', provider: 'xai', name: 'Grok 4.20', tier: 'flagship', contextWindow: 2000000, inputCost: 3, outputCost: 15 },
  { id: 'grok-4-1-fast-reasoning', provider: 'xai', name: 'Grok 4.1 Fast', tier: 'flagship', contextWindow: 2000000, inputCost: 3, outputCost: 15 },
  { id: 'grok-3-beta', provider: 'xai', name: 'Grok 3', tier: 'balanced', contextWindow: 131072, inputCost: 3, outputCost: 15 },
  { id: 'grok-3-mini-beta', provider: 'xai', name: 'Grok 3 Mini', tier: 'fast', contextWindow: 131072, inputCost: 0.3, outputCost: 0.5 },

  // --- Alibaba Qwen ---
  { id: 'qwen-max', provider: 'alibaba', name: 'Qwen Max', tier: 'flagship', contextWindow: 32768, inputCost: 1.6, outputCost: 6.4 },
  { id: 'qwen-plus', provider: 'alibaba', name: 'Qwen Plus', tier: 'balanced', contextWindow: 131072, inputCost: 0.8, outputCost: 2 },
  { id: 'qwen-turbo', provider: 'alibaba', name: 'Qwen Turbo', tier: 'fast', contextWindow: 1000000, inputCost: 0.3, outputCost: 0.6 },
  { id: 'qwen3-235b-a22b', provider: 'alibaba', name: 'Qwen 3 235B', tier: 'flagship', contextWindow: 131072, inputCost: 1.6, outputCost: 6.4 },
  { id: 'qwen3-32b', provider: 'alibaba', name: 'Qwen 3 32B', tier: 'balanced', contextWindow: 131072, inputCost: 0.56, outputCost: 2.24 },

  // --- Moonshot Kimi ---
  { id: 'kimi-k2', provider: 'moonshot', name: 'Kimi K2', tier: 'flagship', contextWindow: 131072, inputCost: 2, outputCost: 8 },
  { id: 'moonshot-v1-128k', provider: 'moonshot', name: 'Moonshot V1 128K', tier: 'balanced', contextWindow: 128000, inputCost: 0.8, outputCost: 0.8 },

  // --- OpenRouter (meta-provider) ---
  { id: 'openrouter/auto', provider: 'openrouter', name: 'OpenRouter Auto', tier: 'balanced', contextWindow: 128000, inputCost: 0, outputCost: 0 },
];

/**
 * Get all models grouped by provider
 */
export function getModelsByProvider() {
  const grouped = {};
  for (const model of MODEL_CATALOG) {
    if (!grouped[model.provider]) {
      grouped[model.provider] = {
        ...MODEL_PROVIDERS[model.provider],
        models: [],
      };
    }
    grouped[model.provider].models.push(model);
  }
  return grouped;
}

/**
 * Find a model by ID
 */
export function getModelById(modelId) {
  return MODEL_CATALOG.find(m => m.id === modelId) || null;
}

/**
 * Get the provider config for a model
 */
export function getProviderForModel(modelId) {
  const model = getModelById(modelId);
  if (!model) return null;
  return MODEL_PROVIDERS[model.provider] || null;
}

/**
 * Get all models for a given tier, optionally filtered by provider.
 * @param {string} tier - 'fast', 'balanced', or 'flagship'
 * @param {string} [providerId] - Optional provider filter
 * @returns {Array} Matching models
 */
export function getModelsForTier(tier, providerId) {
  return MODEL_CATALOG.filter(m => {
    if (m.tier !== tier) return false;
    if (providerId && m.provider !== providerId) return false;
    if (m.id === 'openrouter/auto') return false;
    return true;
  });
}

/**
 * Get the cheapest model for a tier, optionally within a provider.
 * @param {string} tier - 'fast', 'balanced', or 'flagship'
 * @param {string} [providerId] - Optional provider filter
 * @returns {object|null} Cheapest model entry
 */
export function getCheapestModel(tier, providerId) {
  const models = getModelsForTier(tier, providerId);
  if (models.length === 0) return null;
  return models.sort((a, b) => (a.inputCost + a.outputCost) - (b.inputCost + b.outputCost))[0];
}
