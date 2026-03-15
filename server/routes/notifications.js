import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';
import notificationService from '../notifications/service.js';

const router = Router();

// GET /channels - List all notification channels
router.get('/channels', (req, res) => {
  try {
    const db = getDb();
    const channels = db.prepare('SELECT * FROM notification_channels ORDER BY created_at DESC').all();
    res.json(channels.map(ch => ({
      ...ch,
      config: JSON.parse(ch.config),
      event_filters: ch.event_filters ? JSON.parse(ch.event_filters) : [],
    })));
  } catch (error) {
    console.error('List channels error:', error);
    res.status(500).json({ error: 'Failed to list channels' });
  }
});

// POST /channels - Create notification channel
router.post('/channels', (req, res) => {
  try {
    const db = getDb();
    const { type, name, config, event_filters } = req.body;

    if (!type || !name || !config) {
      return res.status(400).json({ error: 'type, name, and config are required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO notification_channels (id, type, name, config, event_filters, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, type, name, JSON.stringify(config), JSON.stringify(event_filters || []), now, now);

    res.status(201).json({ id, type, name, config, event_filters: event_filters || [] });
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// PUT /channels/:id - Update notification channel
router.put('/channels/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, config, enabled, event_filters } = req.body;

    const existing = db.prepare('SELECT id FROM notification_channels WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const now = new Date().toISOString();
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (config !== undefined) { updates.push('config = ?'); params.push(JSON.stringify(config)); }
    if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
    if (event_filters !== undefined) { updates.push('event_filters = ?'); params.push(JSON.stringify(event_filters)); }
    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    db.prepare(`UPDATE notification_channels SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Update channel error:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// DELETE /channels/:id - Delete notification channel
router.delete('/channels/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    db.prepare('DELETE FROM notification_log WHERE channel_id = ?').run(id);
    db.prepare('DELETE FROM notification_channels WHERE id = ?').run(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// POST /channels/:id/test - Send test notification
router.post('/channels/:id/test', async (req, res) => {
  try {
    await notificationService.sendTest(req.params.id);
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /log - Get notification log
router.get('/log', (req, res) => {
  try {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const logs = db.prepare(
      `SELECT nl.*, nc.name as channel_name, nc.type as channel_type
       FROM notification_log nl
       LEFT JOIN notification_channels nc ON nl.channel_id = nc.id
       ORDER BY nl.created_at DESC LIMIT ? OFFSET ?`
    ).all(limit, offset);

    const totalRow = db.prepare('SELECT COUNT(*) as count FROM notification_log').get();

    res.json({
      logs,
      pagination: { page, limit, total: totalRow.count, pages: Math.ceil(totalRow.count / limit) },
    });
  } catch (error) {
    console.error('Notification log error:', error);
    res.status(500).json({ error: 'Failed to get notification log' });
  }
});

export default router;
