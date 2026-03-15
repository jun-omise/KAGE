import { Router } from 'express';
import suggestionEngine from '../mcp/suggestion-engine.js';
import mcpManager from '../mcp/client.js';

const router = Router();

// POST /mcp - Suggest MCP servers based on message content
router.post('/mcp', (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const suggestions = suggestionEngine.suggest(message);

    // Check which servers are already connected
    const connectedServers = new Set(
      mcpManager.getRegisteredTools().map(t => t.serverName || t.name?.split('__')[0])
    );

    const enrichedSuggestions = suggestions.map(s => ({
      ...s,
      connected: connectedServers.has(s.serverId) || connectedServers.has(s.serverName),
    }));

    res.json({ suggestions: enrichedSuggestions });
  } catch (error) {
    console.error('MCP suggestion error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

export default router;
