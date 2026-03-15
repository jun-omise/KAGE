import { Router } from 'express';
import orchestrator from '../core/orchestrator.js';

const router = Router();

// GET /pending - List pending approvals
router.get('/pending', (req, res) => {
  try {
    const pending = orchestrator.pendingApprovals || [];
    res.json(pending);
  } catch (error) {
    console.error('List pending approvals error:', error);
    res.status(500).json({ error: 'Failed to list pending approvals' });
  }
});

// POST /:id/approve - Approve pending action
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    await orchestrator.resolveApproval(id, true);
    res.json({ success: true, id, action: 'approved' });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve action' });
  }
});

// POST /:id/reject - Reject pending action
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    await orchestrator.resolveApproval(id, false);
    res.json({ success: true, id, action: 'rejected' });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject action' });
  }
});

export default router;
