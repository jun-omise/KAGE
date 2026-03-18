import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';
import orchestrator from '../core/orchestrator.js';
import sseManager from '../core/sse-manager.js';

const router = Router();

// POST /api/chat - Send a message and get streamed response
router.post('/chat', async (req, res) => {
  try {
    const db = getDb();
    const { conversationId, message, attachments } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let convId = conversationId;

    // Create conversation if not provided or if provided ID doesn't exist
    if (!convId) {
      convId = uuidv4();
      const title = message.substring(0, 100) || 'New Conversation';
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).run(convId, title, now, now);
    } else {
      // Verify conversation exists, create if it doesn't
      const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
      if (!existing) {
        const title = message.substring(0, 100) || 'New Conversation';
        const now = new Date().toISOString();
        db.prepare(
          'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
        ).run(convId, title, now, now);
      }
    }

    // Save user message
    const userMsgId = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, conversation_id, role, content, attachments, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userMsgId, convId, 'user', message, attachments ? JSON.stringify(attachments) : null, now);

    // Update conversation timestamp
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, convId);

    // Fetch conversation history for context
    let conversationHistory = [];
    try {
      const rows = db.prepare(
        'SELECT role, content FROM messages WHERE conversation_id = ? AND id != ? ORDER BY created_at ASC LIMIT 20'
      ).all(convId, userMsgId);
      conversationHistory = rows.map(r => ({ role: r.role, content: r.content }));
    } catch {}

    // Process message through orchestrator
    try {
      const result = await orchestrator.processMessage({
        conversationId: convId,
        messageId: userMsgId,
        message,
        attachments,
        history: conversationHistory,
      });

      const responseText = result.response || '';

      // Save assistant response with cost and trace
      const assistantMsgId = uuidv4();
      const responseTime = new Date().toISOString();
      db.prepare(
        'INSERT INTO messages (id, conversation_id, role, content, cost, agent_trace, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(assistantMsgId, convId, 'assistant', responseText, result.cost || 0, JSON.stringify(result.trace || []), responseTime);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(responseTime, convId);

      // Update cost_tracking table
      try {
        const today = new Date().toISOString().split('T')[0];
        const tokenUsage = result.token_usage || {};
        const existing = db.prepare('SELECT id FROM cost_tracking WHERE date = ?').get(today);
        if (existing) {
          db.prepare(`
            UPDATE cost_tracking
            SET input_tokens = input_tokens + ?,
                output_tokens = output_tokens + ?,
                cost = cost + ?,
                task_count = task_count + 1
            WHERE date = ?
          `).run(tokenUsage.totalInputTokens || 0, tokenUsage.totalOutputTokens || 0, result.cost || 0, today);
        } else {
          db.prepare(`
            INSERT INTO cost_tracking (id, date, input_tokens, output_tokens, cost, task_count)
            VALUES (?, ?, ?, ?, ?, 1)
          `).run(uuidv4(), today, tokenUsage.totalInputTokens || 0, tokenUsage.totalOutputTokens || 0, result.cost || 0);
        }
      } catch (costErr) {
        console.error('Cost tracking error:', costErr);
      }

      res.json({
        conversationId: convId,
        messageId: assistantMsgId,
        content: responseText,
        trace: result.trace || [],
        cost: result.cost || 0,
      });
    } catch (orchError) {
      console.error('Orchestrator error:', orchError);

      // Send error event via SSE
      try {
        sseManager.send(convId, 'response:error', { message: 'Failed to process message', error: orchError.message });
      } catch {}

      res.status(500).json({ error: 'Failed to process message', details: orchError.message });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /stream/:id - SSE endpoint for streaming responses
router.get('/stream/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Register connection with SSE manager (handles headers + cleanup)
    sseManager.addConnection(id, res);

  } catch (error) {
    console.error('SSE stream error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish stream' });
    }
  }
});

export default router;
