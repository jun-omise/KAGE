import { Router } from 'express';
import { getDb } from '../db/init.js';
import aiClient from '../core/ai-client.js';
import { MODEL_CATALOG, MODEL_PROVIDERS, getModelsByProvider, getModelsForTier, getCheapestModel } from '../core/model-registry.js';
import { classifyComplexity, getRoutingPlan } from '../core/model-router.js';

const router = Router();

// GET /api/models - List all available models grouped by provider
router.get('/', (req, res) => {
  try {
    const providers = aiClient.getConfiguredProviders();
    const grouped = getModelsByProvider();

    // Merge configuration status into grouped data
    const result = Object.entries(grouped).map(([id, group]) => ({
      ...group,
      configured: providers[id]?.configured || false,
      keyPreview: providers[id]?.keyPreview || null,
    }));

    res.json({
      activeModel: aiClient.activeModel,
      providers: result,
    });
  } catch (error) {
    console.error('List models error:', error);
    res.status(500).json({ error: 'Failed to list models' });
  }
});

// GET /api/models/active - Get current active model
router.get('/active', (req, res) => {
  try {
    const modelId = aiClient.activeModel;
    const modelInfo = MODEL_CATALOG.find(m => m.id === modelId);
    const provider = modelInfo ? MODEL_PROVIDERS[modelInfo.provider] : null;

    res.json({
      modelId,
      modelName: modelInfo?.name || modelId,
      provider: provider?.name || 'Unknown',
      tier: modelInfo?.tier || 'unknown',
      contextWindow: modelInfo?.contextWindow || 0,
      inputCost: modelInfo?.inputCost || 0,
      outputCost: modelInfo?.outputCost || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get active model' });
  }
});

// PUT /api/models/active - Switch active model
router.put('/active', (req, res) => {
  try {
    const { modelId } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    aiClient.setActiveModel(modelId);
    const modelInfo = MODEL_CATALOG.find(m => m.id === modelId);

    res.json({
      success: true,
      modelId,
      modelName: modelInfo?.name || modelId,
      provider: modelInfo ? MODEL_PROVIDERS[modelInfo.provider]?.name : 'Unknown',
    });
  } catch (error) {
    console.error('Set active model error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/models/keys - Save API key for a provider
router.post('/keys', (req, res) => {
  try {
    const { providerId, apiKey } = req.body;
    if (!providerId || !apiKey) {
      return res.status(400).json({ error: 'providerId and apiKey are required' });
    }

    const provider = MODEL_PROVIDERS[providerId];
    if (!provider) {
      return res.status(400).json({ error: `Unknown provider: ${providerId}` });
    }

    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)')
      .run(provider.dbConfigKey, apiKey);

    // Reset cached client for this provider
    aiClient.resetProvider(providerId);

    res.json({
      success: true,
      providerId,
      providerName: provider.name,
      keyPreview: `${apiKey.substring(0, 8)}...`,
    });
  } catch (error) {
    console.error('Save API key error:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

// DELETE /api/models/keys/:providerId - Remove API key for a provider
router.delete('/keys/:providerId', (req, res) => {
  try {
    const { providerId } = req.params;
    const provider = MODEL_PROVIDERS[providerId];
    if (!provider) {
      return res.status(400).json({ error: `Unknown provider: ${providerId}` });
    }

    const db = getDb();
    db.prepare('DELETE FROM config WHERE key = ?').run(provider.dbConfigKey);
    aiClient.resetProvider(providerId);

    res.json({ success: true, providerId });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// POST /api/models/test - Test a provider connection
router.post('/test', async (req, res) => {
  try {
    const { modelId } = req.body;
    if (!modelId) {
      return res.status(400).json({ error: 'modelId is required' });
    }

    const start = Date.now();
    const response = await aiClient.chat(
      [{ role: 'user', content: 'Reply with exactly: "KAGE connection test OK"' }],
      { maxTokens: 32, model: modelId }
    );

    const text = response.content?.find(c => c.type === 'text')?.text || '';
    const duration = Date.now() - start;

    res.json({
      success: true,
      modelId,
      response: text.substring(0, 100),
      latency_ms: duration,
      usage: response.usage || null,
    });
  } catch (error) {
    res.json({
      success: false,
      modelId: req.body.modelId,
      error: error.message,
    });
  }
});

// GET /api/models/routing - Get current model routing configuration
router.get('/routing', (req, res) => {
  try {
    const mainModelId = aiClient.activeModel;
    const complexities = ['simple', 'moderate', 'complex'];
    const routing = {};

    for (const complexity of complexities) {
      routing[complexity] = getRoutingPlan(complexity, mainModelId);
    }

    res.json({
      mainModel: mainModelId,
      routing,
      tiers: {
        fast: getModelsForTier('fast').map(m => ({ id: m.id, name: m.name, provider: m.provider, inputCost: m.inputCost, outputCost: m.outputCost })),
        balanced: getModelsForTier('balanced').map(m => ({ id: m.id, name: m.name, provider: m.provider, inputCost: m.inputCost, outputCost: m.outputCost })),
        flagship: getModelsForTier('flagship').map(m => ({ id: m.id, name: m.name, provider: m.provider, inputCost: m.inputCost, outputCost: m.outputCost })),
      },
    });
  } catch (error) {
    console.error('Get routing error:', error);
    res.status(500).json({ error: 'Failed to get routing config' });
  }
});

// POST /api/models/routing/preview - Preview routing for a message
router.post('/routing/preview', (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }

    const complexity = classifyComplexity(message);
    const mainModelId = aiClient.activeModel;
    const routing = getRoutingPlan(complexity, mainModelId);

    res.json({
      message: message.slice(0, 100),
      complexity,
      mainModel: mainModelId,
      routing,
    });
  } catch (error) {
    console.error('Routing preview error:', error);
    res.status(500).json({ error: 'Failed to preview routing' });
  }
});

export default router;
