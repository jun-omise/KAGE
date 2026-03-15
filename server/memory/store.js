import crypto from 'crypto';
import { getDb } from '../db/init.js';

class AgentMemory {
  constructor() {
    this.db = null;
  }

  getDb() {
    if (!this.db) this.db = getDb();
    return this.db;
  }

  store(content, category = 'fact', importance = 0.5) {
    const db = this.getDb();
    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO memories (id, content, category, importance) VALUES (?, ?, ?, ?)'
    ).run(id, content, category, importance);
    return id;
  }

  recall(query, limit = 10) {
    const db = this.getDb();
    const keywords = query.toLowerCase().split(/\s+/);
    const whereClauses = keywords.map(() => 'LOWER(content) LIKE ?').join(' OR ');
    const params = keywords.map((k) => `%${k}%`);

    const memories = db
      .prepare(
        `SELECT *,
          (importance * (1.0 - (julianday('now') - julianday(last_accessed)) * 0.01))
          AS relevance
        FROM memories
        WHERE ${whereClauses}
        ORDER BY relevance DESC
        LIMIT ?`
      )
      .all(...params, limit);

    // Update access records
    for (const mem of memories) {
      db.prepare(
        'UPDATE memories SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1 WHERE id = ?'
      ).run(mem.id);
    }

    return memories;
  }

  getAll(category = null, limit = 50) {
    const db = this.getDb();
    if (category) {
      return db
        .prepare('SELECT * FROM memories WHERE category = ? ORDER BY created_at DESC LIMIT ?')
        .all(category, limit);
    }
    return db
      .prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?')
      .all(limit);
  }

  delete(id) {
    const db = this.getDb();
    return db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  async extractAndStore(conversation) {
    // Placeholder: In production, use Claude API to extract key facts from conversation
    // and classify them into categories (fact, preference, task, context)
    const lastMessage = conversation[conversation.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      // Simple heuristic: store if the message contains factual information
      const content = lastMessage.content;
      if (content.length > 100) {
        this.store(
          content.substring(0, 500),
          'context',
          0.3
        );
      }
    }
  }
}

const agentMemory = new AgentMemory();
export default agentMemory;
