/**
 * KAGE Cron Scheduler
 * Manages automatic task execution based on cron expressions.
 * Uses node-cron for scheduling, integrates with the orchestrator for execution.
 */

import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';
import orchestrator from './orchestrator.js';

class Scheduler {
  constructor() {
    /** @type {Map<string, import('node-cron').ScheduledTask>} */
    this.jobs = new Map();
    /** @type {Map<string, boolean>} taskId → currently running */
    this.running = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the scheduler — load all active cron tasks from DB and schedule them.
   * Called once at server startup.
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const tasks = this._getActiveCronTasks();
      console.log(`[Scheduler] Loading ${tasks.length} cron tasks...`);

      for (const task of tasks) {
        this._scheduleTask(task);
      }

      console.log(`[Scheduler] Initialized with ${this.jobs.size} scheduled jobs`);
    } catch (error) {
      console.error('[Scheduler] Init error:', error.message);
    }
  }

  /**
   * Schedule or reschedule a task by ID.
   * Call this when a task is created or updated.
   * @param {string} taskId
   */
  scheduleById(taskId) {
    // Cancel existing job if any
    this.cancel(taskId);

    const db = getDb();
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) return;

    // Parse trigger_config
    const config = task.trigger_config ? JSON.parse(task.trigger_config) : null;

    // Only schedule if it's a cron task, active, and enabled
    if (task.trigger_type === 'cron' && task.status === 'active' && task.enabled !== 0 && config?.cron) {
      this._scheduleTask({ ...task, trigger_config: config });
    }
  }

  /**
   * Cancel a scheduled job by task ID.
   * @param {string} taskId
   */
  cancel(taskId) {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
      console.log(`[Scheduler] Cancelled job for task ${taskId}`);
    }
  }

  /**
   * Cancel all scheduled jobs. Called on server shutdown.
   */
  cancelAll() {
    for (const [taskId, job] of this.jobs) {
      job.stop();
      console.log(`[Scheduler] Stopped job: ${taskId}`);
    }
    this.jobs.clear();
    this.running.clear();
    this.initialized = false;
  }

  /**
   * Get status of all scheduled jobs.
   * @returns {Array<{taskId: string, name: string, cron: string, nextRun: string|null, isRunning: boolean}>}
   */
  getStatus() {
    const result = [];
    const db = getDb();

    for (const [taskId] of this.jobs) {
      const task = db.prepare('SELECT name, trigger_config FROM tasks WHERE id = ?').get(taskId);
      const config = task?.trigger_config ? JSON.parse(task.trigger_config) : {};

      result.push({
        taskId,
        name: task?.name || 'Unknown',
        cron: config.cron || '',
        isRunning: this.running.get(taskId) || false,
      });
    }

    return result;
  }

  /**
   * Get all active cron tasks from DB.
   * @private
   */
  _getActiveCronTasks() {
    const db = getDb();
    const tasks = db.prepare(`
      SELECT * FROM tasks
      WHERE trigger_type = 'cron'
        AND status = 'active'
        AND (enabled IS NULL OR enabled = 1)
    `).all();

    return tasks.map(t => ({
      ...t,
      trigger_config: t.trigger_config ? JSON.parse(t.trigger_config) : null,
    }));
  }

  /**
   * Schedule a single task with node-cron.
   * @private
   * @param {object} task - Task row with parsed trigger_config
   */
  _scheduleTask(task) {
    const cronExpr = task.trigger_config?.cron;
    if (!cronExpr) {
      console.warn(`[Scheduler] Task ${task.id} has no cron expression, skipping`);
      return;
    }

    if (!cron.validate(cronExpr)) {
      console.error(`[Scheduler] Invalid cron expression "${cronExpr}" for task ${task.id}`);
      return;
    }

    const job = cron.schedule(cronExpr, () => {
      this._executeTask(task.id);
    }, {
      scheduled: true,
      timezone: task.trigger_config?.timezone || undefined,
    });

    this.jobs.set(task.id, job);
    console.log(`[Scheduler] Scheduled task "${task.name}" (${task.id}) with cron: ${cronExpr}`);
  }

  /**
   * Execute a task. Prevents concurrent execution of the same task.
   * @private
   * @param {string} taskId
   */
  async _executeTask(taskId) {
    // Prevent overlapping runs
    if (this.running.get(taskId)) {
      console.log(`[Scheduler] Task ${taskId} is already running, skipping`);
      return;
    }

    this.running.set(taskId, true);
    const db = getDb();

    try {
      // Re-fetch task to get latest data
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
      if (!task || task.status !== 'active') {
        console.log(`[Scheduler] Task ${taskId} no longer active, cancelling`);
        this.cancel(taskId);
        return;
      }

      const message = task.description || task.name;
      const runId = uuidv4();
      const startedAt = new Date().toISOString();

      console.log(`[Scheduler] Executing task "${task.name}" (run: ${runId})`);

      // Record run start
      db.prepare(`
        INSERT INTO task_runs (id, task_id, status, started_at)
        VALUES (?, ?, 'running', ?)
      `).run(runId, taskId, startedAt);

      // Execute through orchestrator
      const startTime = Date.now();
      const result = await orchestrator.processMessage({
        conversationId: `cron_${taskId}_${runId}`,
        messageId: runId,
        message,
        attachments: null,
      });

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      // Record successful completion
      db.prepare(`
        UPDATE task_runs
        SET status = 'completed', result = ?, completed_at = ?, cost = ?, duration_ms = ?
        WHERE id = ?
      `).run(
        JSON.stringify({ response: result.response, trace: result.trace }),
        completedAt,
        result.cost || 0,
        durationMs,
        runId
      );

      // Update last_run_at on the task
      db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(completedAt, taskId);

      console.log(`[Scheduler] Task "${task.name}" completed in ${durationMs}ms (cost: $${(result.cost || 0).toFixed(4)})`);

    } catch (error) {
      console.error(`[Scheduler] Task ${taskId} execution failed:`, error.message);

      try {
        const failedAt = new Date().toISOString();
        // Find the latest running run for this task
        const latestRun = db.prepare(`
          SELECT id FROM task_runs
          WHERE task_id = ? AND status = 'running'
          ORDER BY started_at DESC LIMIT 1
        `).get(taskId);

        if (latestRun) {
          db.prepare(`
            UPDATE task_runs SET status = 'failed', result = ?, completed_at = ? WHERE id = ?
          `).run(JSON.stringify({ error: error.message }), failedAt, latestRun.id);
        }
      } catch (dbError) {
        console.error('[Scheduler] Failed to record error:', dbError.message);
      }
    } finally {
      this.running.set(taskId, false);
    }
  }
}

const scheduler = new Scheduler();
export default scheduler;
