import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';

const router = Router();

// GET / - List memories (optional category filter)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { category } = req.query;

    let memories;
    if (category) {
      memories = db.prepare(
        'SELECT * FROM memories WHERE category = ? ORDER BY created_at DESC'
      ).all(category);
    } else {
      memories = db.prepare(
        'SELECT * FROM memories ORDER BY created_at DESC'
      ).all();
    }

    const parsed = memories.map((m) => ({
      ...m,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
    }));

    res.json(parsed);
  } catch (error) {
    console.error('List memories error:', error);
    res.status(500).json({ error: 'Failed to list memories' });
  }
});

// POST / - Create a memory
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const { content, category, importance } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Memory content is required' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO memories (id, content, category, importance, created_at, last_accessed) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, content, category || 'general', importance || 0.5, now, now);

    res.status(201).json({ id, content, category: category || 'general', importance: importance || 0.5, created_at: now });
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ error: 'Failed to create memory' });
  }
});

// POST /search - Search memories
router.post('/search', (req, res) => {
  try {
    const db = getDb();
    const { query, limit } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const searchLimit = limit || 20;

    // Basic text search using LIKE (can be upgraded to FTS or vector search later)
    const memories = db.prepare(
      'SELECT * FROM memories WHERE content LIKE ? OR category LIKE ? ORDER BY created_at DESC LIMIT ?'
    ).all(`%${query}%`, `%${query}%`, searchLimit);

    const parsed = memories.map((m) => ({
      ...m,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Search memories error:', error);
    res.status(500).json({ error: 'Failed to search memories' });
  }
});

// DELETE /:id - Delete memory
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM memories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    db.prepare('DELETE FROM memories WHERE id = ?').run(id);

    res.json({ success: true, id });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ error: 'Failed to delete memory' });
  }
});

export default router;
