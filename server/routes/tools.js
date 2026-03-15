import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';
import mcpManager from '../mcp/client.js';
import { BUILTIN_MCP_SERVERS } from '../mcp/builtin-servers.js';
import { TEST_SCENARIOS, runTestScenario } from '../mcp/test-scenarios.js';

const router = Router();

// GET /builtin - List all builtin MCP server definitions
router.get('/builtin', (req, res) => {
  res.json(BUILTIN_MCP_SERVERS.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category || 'other',
    command: s.command,
    args: s.args,
    env: s.env,
    permissions: s.permissions,
    default_enabled: s.default_enabled,
    envKeys: s.envKeys || [],
  })));
});

// GET / - List all tool configs
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const tools = db.prepare('SELECT * FROM tool_configs ORDER BY created_at DESC').all();

    const parsed = tools.map((t) => ({
      ...t,
      config: t.config ? JSON.parse(t.config) : null,
      permissions: t.permissions ? JSON.parse(t.permissions) : null,
    }));

    res.json(parsed);
  } catch (error) {
    console.error('List tools error:', error);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// POST /connect - Connect MCP server
router.post('/connect', (req, res) => {
  try {
    const db = getDb();
    const { name, type, config, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tool name is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tool_configs (id, name, type, config, permissions, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'connected', ?, ?)
    `).run(
      id,
      name,
      type || 'mcp',
      config ? JSON.stringify(config) : null,
      permissions ? JSON.stringify(permissions) : null,
      now,
      now
    );

    res.status(201).json({
      id,
      name,
      type: type || 'mcp',
      config,
      permissions,
      status: 'connected',
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    console.error('Connect tool error:', error);
    res.status(500).json({ error: 'Failed to connect tool' });
  }
});

// DELETE /:id - Disconnect/remove tool
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM tool_configs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    db.prepare('DELETE FROM tool_configs WHERE id = ?').run(id);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Failed to disconnect tool' });
  }
});

// PUT /:id/config - Update tool config
router.put('/:id/config', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, type, config, permissions } = req.body;

    const existing = db.prepare('SELECT id FROM tool_configs WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(config)); }
    if (permissions !== undefined) { updates.push('permissions = ?'); values.push(JSON.stringify(permissions)); }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE tool_configs SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM tool_configs WHERE id = ?').get(id);
    res.json({
      ...updated,
      config: updated.config ? JSON.parse(updated.config) : null,
      permissions: updated.permissions ? JSON.parse(updated.permissions) : null,
    });
  } catch (error) {
    console.error('Update tool config error:', error);
    res.status(500).json({ error: 'Failed to update tool config' });
  }
});

// POST /:id/test - Test MCP server connection
router.post('/:id/test', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const tool = db.prepare('SELECT * FROM tool_configs WHERE id = ?').get(id);
    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const config = tool.config ? JSON.parse(tool.config) : {};

    if (!config.command) {
      return res.status(400).json({
        success: false,
        id,
        name: tool.name,
        error: 'No command configured for this MCP server',
      });
    }

    // Attempt real MCP connection
    try {
      await mcpManager.connectServer({
        id: tool.name,
        command: config.command,
        args: config.args || [],
        env: config.env || {},
        permissions: tool.permissions ? JSON.parse(tool.permissions) : [],
      });

      const tools = mcpManager.getRegisteredTools().filter(t => t.serverId === tool.name);

      // Disconnect after test
      await mcpManager.disconnectServer(tool.name);

      // Update status in DB
      db.prepare("UPDATE tool_configs SET status = 'connected', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), id);

      res.json({
        success: true,
        id,
        name: tool.name,
        message: `Connection successful. ${tools.length} tool(s) discovered.`,
        tools: tools.map(t => ({ name: t.name, description: t.description })),
      });
    } catch (connError) {
      // Update status to error
      db.prepare("UPDATE tool_configs SET status = 'error', updated_at = ? WHERE id = ?")
        .run(new Date().toISOString(), id);

      res.json({
        success: false,
        id,
        name: tool.name,
        error: connError.message,
      });
    }
  } catch (error) {
    console.error('Test tool error:', error);
    res.status(500).json({ error: 'Failed to test tool connection' });
  }
});

// GET /test-scenarios - List available test scenarios
router.get('/test-scenarios', (req, res) => {
  res.json(TEST_SCENARIOS.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    requiredTools: s.requiredTools,
    steps: s.steps.map(st => ({ description: st.description })),
  })));
});

// POST /test-scenario - Run a test scenario against a connected MCP server
router.post('/test-scenario', async (req, res) => {
  try {
    const { scenarioId, serverId } = req.body;

    if (!scenarioId || !serverId) {
      return res.status(400).json({ error: 'scenarioId and serverId are required' });
    }

    const scenario = TEST_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: `Scenario '${scenarioId}' not found` });
    }

    const result = await runTestScenario(scenarioId, serverId, mcpManager);
    res.json(result);
  } catch (error) {
    console.error('Test scenario error:', error);
    res.status(500).json({ error: error.message || 'Failed to run test scenario' });
  }
});

export default router;
