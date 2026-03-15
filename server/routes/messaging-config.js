import { Router } from 'express';
import { getDb } from '../db/init.js';

const router = Router();

const PLATFORMS = ['line', 'whatsapp', 'messenger'];

// GET /config - Get messaging platform configs
router.get('/config', (req, res) => {
  try {
    const db = getDb();
    const configs = {};

    for (const platform of PLATFORMS) {
      const row = db.prepare(`SELECT value FROM config WHERE key = ?`).get(`messaging_${platform}`);
      configs[platform] = row ? JSON.parse(row.value) : { enabled: false };
    }

    res.json(configs);
  } catch (error) {
    console.error('Get messaging config error:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

// PUT /config/:platform - Update platform config
router.put('/config/:platform', (req, res) => {
  try {
    const { platform } = req.params;
    if (!PLATFORMS.includes(platform)) {
      return res.status(400).json({ error: `Invalid platform. Must be one of: ${PLATFORMS.join(', ')}` });
    }

    const db = getDb();
    const config = req.body;
    const key = `messaging_${platform}`;

    db.prepare(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
    ).run(key, JSON.stringify(config));

    res.json({ success: true, platform, config });
  } catch (error) {
    console.error('Update messaging config error:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

// GET /sessions - List active messaging sessions
router.get('/sessions', (req, res) => {
  try {
    const db = getDb();
    const sessions = db.prepare(
      'SELECT * FROM messaging_sessions ORDER BY last_active DESC'
    ).all();
    res.json(sessions);
  } catch (error) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// DELETE /sessions/:id - Revoke a session
router.delete('/sessions/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM messaging_sessions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

export default router;
