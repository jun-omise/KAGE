import { Router } from 'express';
import { getDb } from '../db/init.js';
import orchestrator from '../core/orchestrator.js';
import { recordApproval } from '../security/permission-engine.js';
import { AuditLogger } from '../security/audit-logger.js';

const router = Router();
const auditLogger = new AuditLogger();

// GET /pending - List pending approvals
router.get('/pending', (req, res) => {
  try {
    const pending = [];
    for (const [id, approval] of orchestrator.pendingApprovals) {
      if (approval.resolved === undefined) {
        pending.push({
          id,
          action: approval.reason || 'Approval required',
          tool: approval.tool || null,
          plan: approval.plan || null,
          estimated_cost: approval.estimated_cost || 0,
          conversationId: approval.conversationId,
          description: approval.description || '',
          category: approval.category || 'unknown',
          args_preview: approval.argsPreview || null,
        });
      }
    }
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
    const { autoApprove } = req.body || {};

    // Resolve the approval
    orchestrator.resolveApproval(id, true);

    // If autoApprove flag set, remember for ask_first policy
    const approval = orchestrator.pendingApprovals.get(id);
    if (autoApprove && approval?.tool) {
      recordApproval(approval.tool, true);
    }

    // Persist to DB
    try {
      const db = getDb();
      db.prepare(
        "UPDATE approval_queue SET status = 'approved', resolved_at = datetime('now') WHERE id = ?"
      ).run(id);
    } catch {}

    auditLogger.log('approved', { approvalId: id, autoApprove: !!autoApprove });

    res.json({ success: true, id, action: 'approved', autoApprove: !!autoApprove });
  } catch (error) {
    console.error('Approve error:', error);
    res.status(500).json({ error: 'Failed to approve action' });
  }
});

// POST /:id/reject - Reject pending action
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    orchestrator.resolveApproval(id, false);

    // Persist to DB
    try {
      const db = getDb();
      db.prepare(
        "UPDATE approval_queue SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?"
      ).run(id);
    } catch {}

    auditLogger.log('blocked', { approvalId: id, reason: reason || 'User rejected' });

    res.json({ success: true, id, action: 'rejected', reason: reason || null });
  } catch (error) {
    console.error('Reject error:', error);
    res.status(500).json({ error: 'Failed to reject action' });
  }
});

export default router;
