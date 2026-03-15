import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';
import orchestrator from '../core/orchestrator.js';

const router = Router();

// GET / - List all tasks
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();

    const parsed = tasks.map((t) => ({
      ...t,
      trigger_config: t.trigger_config ? JSON.parse(t.trigger_config) : null,
      permissions: t.permissions ? JSON.parse(t.permissions) : null,
      settings: t.settings ? JSON.parse(t.settings) : null,
    }));

    res.json(parsed);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// POST / - Create task
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { name, description, trigger_type, trigger_config, permissions, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Task name is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO tasks (id, name, description, trigger_type, trigger_config, permissions, settings, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id,
      name,
      description || null,
      trigger_type || 'manual',
      trigger_config ? JSON.stringify(trigger_config) : null,
      permissions ? JSON.stringify(permissions) : null,
      settings ? JSON.stringify(settings) : null,
      now,
      now
    );

    res.status(201).json({
      id,
      name,
      description,
      trigger_type: trigger_type || 'manual',
      trigger_config,
      permissions,
      settings,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /:id - Update task
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, description, trigger_type, trigger_config, permissions, settings, status } = req.body;

    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const now = new Date().toISOString();
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (trigger_type !== undefined) { updates.push('trigger_type = ?'); values.push(trigger_type); }
    if (trigger_config !== undefined) { updates.push('trigger_config = ?'); values.push(JSON.stringify(trigger_config)); }
    if (permissions !== undefined) { updates.push('permissions = ?'); values.push(JSON.stringify(permissions)); }
    if (settings !== undefined) { updates.push('settings = ?'); values.push(JSON.stringify(settings)); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    res.json({
      ...updated,
      trigger_config: updated.trigger_config ? JSON.parse(updated.trigger_config) : null,
      permissions: updated.permissions ? JSON.parse(updated.permissions) : null,
      settings: updated.settings ? JSON.parse(updated.settings) : null,
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /:id - Delete task
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    db.prepare('DELETE FROM task_runs WHERE task_id = ?').run(id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST /:id/run - Manual task execution (real orchestrator integration)
router.post('/:id/run', async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const runId = uuidv4();
    const startedAt = new Date().toISOString();

    // Insert a "running" record
    db.prepare(`
      INSERT INTO task_runs (id, task_id, status, started_at)
      VALUES (?, ?, 'running', ?)
    `).run(runId, id, startedAt);

    // Return immediately so the client knows execution started
    res.json({ success: true, runId, taskId: id, status: 'running' });

    // Execute asynchronously through the orchestrator
    try {
      const result = await orchestrator.processMessage({
        conversationId: `task_${id}_${runId}`,
        messageId: runId,
        message: task.description || task.name,
        attachments: null,
      });

      const completedAt = new Date().toISOString();
      db.prepare(`
        UPDATE task_runs SET status = 'completed', result = ?, completed_at = ?, cost = ? WHERE id = ?
      `).run(
        JSON.stringify({ response: result.response, trace: result.trace }),
        completedAt,
        result.cost || 0,
        runId
      );
    } catch (execError) {
      const failedAt = new Date().toISOString();
      db.prepare(`
        UPDATE task_runs SET status = 'failed', result = ?, completed_at = ? WHERE id = ?
      `).run(JSON.stringify({ error: execError.message }), failedAt, runId);
      console.error('Task execution error:', execError);
    }
  } catch (error) {
    console.error('Run task error:', error);
    res.status(500).json({ error: 'Failed to run task' });
  }
});

// GET /:id/history - Get task run history
router.get('/:id/history', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const history = db.prepare(
      'SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC'
    ).all(id);

    res.json(history);
  } catch (error) {
    console.error('Task history error:', error);
    res.status(500).json({ error: 'Failed to get task history' });
  }
});

export default router;
