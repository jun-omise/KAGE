import { Router } from 'express';
import { getDb } from '../db/init.js';
import orchestrator from '../core/orchestrator.js';
import { getShellPolicy, setCustomPolicy, getCustomPolicies, analyzeCommand } from '../security/shell-policy.js';
import { getSandboxConfig } from '../security/sandbox.js';

const router = Router();

const DEFAULT_SECURITY_CONFIG = {
  cost: {
    per_task_limit: 1.00,
    daily_limit: 10.00,
    monthly_limit: 100.00,
    alert_threshold: 0.80,
  },
  permissions: {
    auto_approve_read: true,
    auto_approve_write: false,
    auto_approve_delete: false,
    auto_approve_external: false,
  },
  loop_detection: {
    max_same_tool_calls: 3,
    max_agent_bounces: 5,
    max_task_duration_ms: 60000,
    max_tokens_per_task: 100000,
  },
  pii_protection: {
    enabled: true,
    patterns: ['credit_card', 'ssn', 'phone', 'email', 'api_key'],
    action: 'mask',
  },
  audit: {
    enabled: true,
    log_tool_calls: true,
    log_agent_thoughts: true,
    log_costs: true,
    retention_days: 30,
  },
};

// GET /config - Get current security config
router.get('/config', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'security_config'").get();

    if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.json(DEFAULT_SECURITY_CONFIG);
    }
  } catch (error) {
    console.error('Get security config error:', error);
    res.status(500).json({ error: 'Failed to get security config' });
  }
});

// PUT /config - Update security config
router.put('/config', (req, res) => {
  try {
    const db = getDb();
    const config = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Invalid security config' });
    }

    // Merge with defaults to ensure all fields exist
    const merged = {
      cost: { ...DEFAULT_SECURITY_CONFIG.cost, ...config.cost },
      permissions: { ...DEFAULT_SECURITY_CONFIG.permissions, ...config.permissions },
      loop_detection: { ...DEFAULT_SECURITY_CONFIG.loop_detection, ...config.loop_detection },
      pii_protection: { ...DEFAULT_SECURITY_CONFIG.pii_protection, ...config.pii_protection },
      audit: { ...DEFAULT_SECURITY_CONFIG.audit, ...config.audit },
    };

    const value = JSON.stringify(merged);

    db.prepare(
      "INSERT OR REPLACE INTO config (key, value) VALUES ('security_config', ?)"
    ).run(value);

    res.json(merged);
  } catch (error) {
    console.error('Update security config error:', error);
    res.status(500).json({ error: 'Failed to update security config' });
  }
});

// GET /events - List security events (paginated)
router.get('/events', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const events = db.prepare(
      'SELECT * FROM security_events ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    const totalRow = db.prepare('SELECT COUNT(*) as count FROM security_events').get();
    const total = totalRow.count;

    res.json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('List security events error:', error);
    res.status(500).json({ error: 'Failed to list security events' });
  }
});

// GET /cost - Get cost summary
router.get('/cost', (req, res) => {
  try {
    const db = getDb();

    const todayRow = db.prepare(
      "SELECT COALESCE(SUM(cost), 0) as total FROM cost_tracking WHERE date = date('now')"
    ).get();

    const monthRow = db.prepare(
      "SELECT COALESCE(SUM(cost), 0) as total FROM cost_tracking WHERE substr(date, 1, 7) = strftime('%Y-%m', 'now')"
    ).get();

    const allTimeRow = db.prepare(
      "SELECT COALESCE(SUM(cost), 0) as total FROM cost_tracking"
    ).get();

    res.json({
      today: todayRow.total,
      this_month: monthRow.total,
      all_time: allTimeRow.total,
    });
  } catch (error) {
    console.error('Cost summary error:', error);
    res.status(500).json({ error: 'Failed to get cost summary' });
  }
});

// POST /kill - Emergency stop all agents
router.post('/kill', (req, res) => {
  try {
    orchestrator.killAll();
    res.json({ success: true, message: 'All agents stopped' });
  } catch (error) {
    console.error('Kill all error:', error);
    res.status(500).json({ error: 'Failed to stop agents' });
  }
});

// ══════════════════════════════════════
// Shell Policy Endpoints
// ══════════════════════════════════════

// GET /shell-policy - Get shell command policy
router.get('/shell-policy', (req, res) => {
  try {
    res.json(getShellPolicy());
  } catch (error) {
    console.error('Get shell policy error:', error);
    res.status(500).json({ error: 'Failed to get shell policy' });
  }
});

// POST /shell-policy/analyze - Analyze a command before execution
router.post('/shell-policy/analyze', (req, res) => {
  try {
    const { command } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }
    res.json(analyzeCommand(command));
  } catch (error) {
    console.error('Analyze command error:', error);
    res.status(500).json({ error: 'Failed to analyze command' });
  }
});

// PUT /shell-policy/custom - Set custom policy for a command
router.put('/shell-policy/custom', (req, res) => {
  try {
    const { command, policy } = req.body;
    if (!command || !['allowed', 'approval', 'blocked'].includes(policy)) {
      return res.status(400).json({ error: 'command and policy (allowed|approval|blocked) are required' });
    }
    setCustomPolicy(command, policy);
    res.json({ success: true, command, policy });
  } catch (error) {
    console.error('Set shell policy error:', error);
    res.status(500).json({ error: 'Failed to set shell policy' });
  }
});

// GET /shell-policy/custom - Get all custom policies
router.get('/shell-policy/custom', (req, res) => {
  try {
    res.json(getCustomPolicies());
  } catch (error) {
    console.error('Get custom policies error:', error);
    res.status(500).json({ error: 'Failed to get custom policies' });
  }
});

// GET /sandbox - Get sandbox configuration
router.get('/sandbox', (req, res) => {
  try {
    res.json(getSandboxConfig());
  } catch (error) {
    console.error('Get sandbox config error:', error);
    res.status(500).json({ error: 'Failed to get sandbox config' });
  }
});

export default router;
