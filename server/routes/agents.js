import { Router } from 'express';
import orchestrator from '../core/orchestrator.js';

const router = Router();

// POST /pause - Pause agent processing
router.post('/pause', (req, res) => {
  try {
    // Set paused flag on all active tasks
    for (const [taskId, task] of orchestrator.activeTasks) {
      task.paused = true;
    }
    res.json({ success: true, message: 'Agent processing paused' });
  } catch (error) {
    console.error('Pause agents error:', error);
    res.status(500).json({ error: 'Failed to pause agents' });
  }
});

// POST /resume - Resume agent processing
router.post('/resume', (req, res) => {
  try {
    for (const [taskId, task] of orchestrator.activeTasks) {
      task.paused = false;
    }
    res.json({ success: true, message: 'Agent processing resumed' });
  } catch (error) {
    console.error('Resume agents error:', error);
    res.status(500).json({ error: 'Failed to resume agents' });
  }
});

// POST /stop - Stop all agent processing
router.post('/stop', (req, res) => {
  try {
    orchestrator.killAll();
    res.json({ success: true, message: 'All agents stopped' });
  } catch (error) {
    console.error('Stop agents error:', error);
    res.status(500).json({ error: 'Failed to stop agents' });
  }
});

// GET /status - Get active agent status
router.get('/status', (req, res) => {
  try {
    const active = [];
    for (const [taskId, task] of orchestrator.activeTasks) {
      active.push({
        taskId,
        paused: !!task.paused,
        cancelled: !!task.cancelled,
        phase: task.phase || 'unknown',
      });
    }
    res.json({ active, count: active.length });
  } catch (error) {
    console.error('Agent status error:', error);
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

export default router;
