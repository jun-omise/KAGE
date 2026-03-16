import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import orchestrator from './orchestrator.js';
import sseManager from './sse-manager.js';

/**
 * TaskQueue - Manages parallel task execution
 * Supports submitting multiple tasks that run concurrently,
 * with per-task progress tracking via SSE.
 */
class TaskQueue extends EventEmitter {
  constructor() {
    super();
    this.tasks = new Map();       // taskId -> taskState
    this.maxConcurrent = 5;       // max parallel tasks
    this.globalListeners = new Set(); // SSE connections watching all tasks
  }

  /**
   * Submit a new task to the queue
   */
  submit({ message, priority = 'normal', label }) {
    const taskId = uuid();
    const conversationId = `queue_${taskId}`;
    const now = Date.now();

    const task = {
      id: taskId,
      conversationId,
      message,
      label: label || message.substring(0, 60),
      priority,
      status: 'queued',      // queued -> running -> completed | failed | cancelled
      progress: {
        phase: 'queued',
        stepIndex: 0,
        totalSteps: 0,
        description: 'Waiting in queue...',
      },
      agentStates: {
        sentinel: { status: 'idle' },
        planner: { status: 'idle' },
        executor: { status: 'idle' },
        reviewer: { status: 'idle' },
      },
      result: null,
      error: null,
      cost: 0,
      createdAt: now,
      startedAt: null,
      completedAt: null,
    };

    this.tasks.set(taskId, task);
    this._broadcastTaskUpdate(task);

    // Start immediately if under concurrency limit
    this._tryStartNext();

    return task;
  }

  /**
   * Submit multiple tasks at once (batch)
   */
  submitBatch(items) {
    const tasks = items.map(item => this.submit(item));
    return tasks;
  }

  /**
   * Cancel a task
   */
  cancel(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running') {
      orchestrator.cancelTask(task.orchestratorTaskId);
    }

    task.status = 'cancelled';
    task.completedAt = Date.now();
    this._broadcastTaskUpdate(task);
    this._tryStartNext();
    return true;
  }

  /**
   * Get all tasks
   */
  getAll() {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get a single task
   */
  get(taskId) {
    return this.tasks.get(taskId) || null;
  }

  /**
   * Clear completed/failed/cancelled tasks
   */
  clearFinished() {
    for (const [id, task] of this.tasks) {
      if (['completed', 'failed', 'cancelled'].includes(task.status)) {
        this.tasks.delete(id);
      }
    }
    this._broadcastFullState();
  }

  /**
   * Register a global SSE listener for all task updates
   */
  addGlobalListener(res) {
    this.globalListeners.add(res);
    res.on('close', () => {
      this.globalListeners.delete(res);
    });

    // Send current state immediately
    const payload = `event: taskqueue:state\ndata: ${JSON.stringify({
      tasks: this.getAll(),
      timestamp: Date.now(),
    })}\n\n`;
    res.write(payload);
  }

  // --- Internal methods ---

  _getRunningCount() {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.status === 'running') count++;
    }
    return count;
  }

  _tryStartNext() {
    if (this._getRunningCount() >= this.maxConcurrent) return;

    // Find next queued task (priority: high > normal > low)
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const queued = Array.from(this.tasks.values())
      .filter(t => t.status === 'queued')
      .sort((a, b) => {
        const pa = priorityOrder[a.priority] ?? 1;
        const pb = priorityOrder[b.priority] ?? 1;
        if (pa !== pb) return pa - pb;
        return a.createdAt - b.createdAt;
      });

    for (const task of queued) {
      if (this._getRunningCount() >= this.maxConcurrent) break;
      this._executeTask(task);
    }
  }

  async _executeTask(task) {
    task.status = 'running';
    task.startedAt = Date.now();
    task.progress = {
      phase: 'starting',
      stepIndex: 0,
      totalSteps: 6,
      description: 'Starting task...',
    };
    this._broadcastTaskUpdate(task);

    // Set up SSE listener for this task's conversation to relay progress
    const conversationId = task.conversationId;
    this._setupProgressRelay(task);

    try {
      const result = await orchestrator.processMessage({
        conversationId,
        messageId: uuid(),
        message: task.message,
        attachments: null,
      });

      task.status = result.blocked ? 'failed' : 'completed';
      task.result = {
        response: result.response,
        trace: result.trace,
        tools_used: result.tools_used,
        complexity: result.complexity,
        token_usage: result.token_usage,
      };
      task.cost = result.cost || 0;
      task.error = result.blocked ? result.response : null;
      task.completedAt = Date.now();
      task.progress = {
        phase: 'done',
        stepIndex: task.progress.totalSteps,
        totalSteps: task.progress.totalSteps,
        description: task.status === 'completed' ? 'Completed' : 'Failed',
      };

      // Update all agent states to complete
      for (const key of Object.keys(task.agentStates)) {
        if (task.agentStates[key].status === 'active' || task.agentStates[key].status === 'running') {
          task.agentStates[key].status = 'complete';
        }
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = Date.now();
      task.progress = {
        phase: 'error',
        stepIndex: 0,
        totalSteps: 0,
        description: `Error: ${error.message}`,
      };
    }

    this._broadcastTaskUpdate(task);

    // Start next queued task
    this._tryStartNext();
  }

  _setupProgressRelay(task) {
    const conversationId = task.conversationId;

    // Use sseManager's EventEmitter to listen for events
    const handler = ({ convId, event, data }) => {
      if (convId !== conversationId) return;

      switch (event) {
        case 'pipeline:progress':
          task.progress = {
            phase: data.phase,
            stepIndex: data.stepIndex,
            totalSteps: data.totalSteps,
            description: data.description,
            elapsed_ms: data.elapsed_ms,
          };
          break;

        case 'agent:start':
          if (task.agentStates[data.agent]) {
            task.agentStates[data.agent] = {
              status: 'active',
              action: data.action,
              model: data.model,
            };
          }
          break;

        case 'agent:complete':
          if (task.agentStates[data.agent]) {
            task.agentStates[data.agent] = {
              status: 'complete',
              duration_ms: data.duration_ms,
            };
          }
          break;

        case 'agent:detail':
          if (task.agentStates[data.agent]) {
            task.agentStates[data.agent] = {
              ...task.agentStates[data.agent],
              detail: {
                currentAction: data.currentAction,
                toolName: data.toolName,
                outputPreview: data.outputPreview,
              },
            };
          }
          break;

        case 'executor:subtask_progress':
          task.subtaskProgress = {
            subtaskIndex: data.subtaskIndex,
            totalSubtasks: data.totalSubtasks,
            description: data.description,
          };
          break;

        case 'agent:warning':
          task.lastWarning = data.message;
          break;

        default:
          return; // Don't broadcast for unhandled events
      }

      this._broadcastTaskUpdate(task);
    };

    sseManager.on('send', handler);

    // Remove listener when task completes
    const checkDone = setInterval(() => {
      if (['completed', 'failed', 'cancelled'].includes(task.status)) {
        sseManager.off('send', handler);
        clearInterval(checkDone);
      }
    }, 1000);
  }

  _broadcastTaskUpdate(task) {
    const payload = `event: taskqueue:update\ndata: ${JSON.stringify({
      task: this._serializeTask(task),
      timestamp: Date.now(),
    })}\n\n`;

    for (const res of this.globalListeners) {
      try {
        res.write(payload);
      } catch {
        this.globalListeners.delete(res);
      }
    }
  }

  _broadcastFullState() {
    const payload = `event: taskqueue:state\ndata: ${JSON.stringify({
      tasks: this.getAll().map(t => this._serializeTask(t)),
      timestamp: Date.now(),
    })}\n\n`;

    for (const res of this.globalListeners) {
      try {
        res.write(payload);
      } catch {
        this.globalListeners.delete(res);
      }
    }
  }

  _serializeTask(task) {
    return {
      id: task.id,
      label: task.label,
      message: task.message,
      priority: task.priority,
      status: task.status,
      progress: task.progress,
      agentStates: task.agentStates,
      subtaskProgress: task.subtaskProgress || null,
      lastWarning: task.lastWarning || null,
      result: task.result ? {
        response: task.result.response,
        complexity: task.result.complexity,
        tools_used: task.result.tools_used,
      } : null,
      error: task.error,
      cost: task.cost,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    };
  }
}

const taskQueue = new TaskQueue();
export default taskQueue;
