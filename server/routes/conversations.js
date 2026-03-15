import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';

const router = Router();

// GET / - List all conversations
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const conversations = db.prepare(`
      SELECT
        c.id,
        c.title,
        c.created_at,
        c.updated_at,
        m.content AS last_message
      FROM conversations c
      LEFT JOIN (
        SELECT conversation_id, content,
          ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY created_at DESC) AS rn
        FROM messages
      ) m ON m.conversation_id = c.id AND m.rn = 1
      ORDER BY c.updated_at DESC
    `).all();

    res.json(conversations);
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /:id - Get conversation with paginated messages
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?'
    ).all(id, limit, offset);

    const totalRow = db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
    ).get(id);
    const total = totalRow.count;

    res.json({
      ...conversation,
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// POST / - Create new conversation
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { title } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();
    const convTitle = title || `Conversation ${now.split('T')[0]}`;

    db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(id, convTitle, now, now);

    res.status(201).json({ id, title: convTitle, created_at: now, updated_at: now });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// PUT /:id - Update conversation title
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id);

    res.json({ id, title, updated_at: now });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /:id - Delete conversation and messages
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id);
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
