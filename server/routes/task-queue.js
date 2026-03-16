import { Router } from 'express';
import taskQueue from '../core/task-queue.js';

const router = Router();

// POST /submit - Submit a single task
router.post('/submit', (req, res) => {
  try {
    const { message, priority, label } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const task = taskQueue.submit({ message, priority, label });
    res.status(201).json(task);
  } catch (error) {
    console.error('Task submit error:', error);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// POST /batch - Submit multiple tasks at once
router.post('/batch', (req, res) => {
  try {
    const { tasks: items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Tasks array is required' });
    }
    if (items.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 tasks per batch' });
    }
    const tasks = taskQueue.submitBatch(items);
    res.status(201).json({ tasks });
  } catch (error) {
    console.error('Task batch submit error:', error);
    res.status(500).json({ error: 'Failed to submit tasks' });
  }
});

// GET / - List all tasks in queue
router.get('/', (req, res) => {
  try {
    const tasks = taskQueue.getAll();
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// GET /:id - Get single task status
router.get('/:id', (req, res) => {
  try {
    const task = taskQueue.get(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// POST /:id/cancel - Cancel a task
router.post('/:id/cancel', (req, res) => {
  try {
    const success = taskQueue.cancel(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel task' });
  }
});

// POST /clear - Clear finished tasks
router.post('/clear', (req, res) => {
  try {
    taskQueue.clearFinished();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear tasks' });
  }
});

// GET /stream - SSE endpoint for all task updates
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');
  taskQueue.addGlobalListener(res);
});

export default router;
