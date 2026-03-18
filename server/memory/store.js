import crypto from 'crypto';
import { getDb } from '../db/init.js';
import aiClient from '../core/ai-client.js';

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
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);
    if (keywords.length === 0) return [];

    const whereClauses = keywords.map(() => 'LOWER(content) LIKE ?').join(' OR ');
    const params = keywords.map((k) => `%${k}%`);

    const memories = db
      .prepare(
        `SELECT *,
          (importance * (1.0 - CAST(MIN(julianday('now') - julianday(last_accessed), 30) AS REAL) * 0.01))
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
        .prepare('SELECT * FROM memories WHERE category = ? ORDER BY importance DESC, created_at DESC LIMIT ?')
        .all(category, limit);
    }
    return db
      .prepare('SELECT * FROM memories ORDER BY importance DESC, created_at DESC LIMIT ?')
      .all(limit);
  }

  getStats() {
    const db = this.getDb();
    try {
      const total = db.prepare('SELECT COUNT(*) as count FROM memories').get();
      const categories = db.prepare(
        'SELECT category, COUNT(*) as count FROM memories GROUP BY category'
      ).all();
      return {
        total: total.count,
        categories: Object.fromEntries(categories.map(c => [c.category, c.count])),
      };
    } catch {
      return { total: 0, categories: {} };
    }
  }

  delete(id) {
    const db = this.getDb();
    return db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  deleteAll() {
    const db = this.getDb();
    return db.prepare('DELETE FROM memories').run();
  }

  /**
   * Extract important memories from a conversation using Claude API.
   * Categorizes into fact/preference/context/task with importance scores.
   */
  async extractFromConversation(messages) {
    if (!messages || messages.length < 2) return [];

    try {
      // Build conversation summary for extraction
      const conversationText = messages
        .slice(-10) // Last 10 messages max
        .map(m => `${m.role}: ${(m.content || '').slice(0, 500)}`)
        .join('\n');

      const config = {
        role: 'memory_extractor',
        purpose: 'Extract important facts, preferences, and context from conversations',
        systemPrompt: `You extract key memories from conversations. Respond ONLY in JSON array format.

For each important piece of information, create an entry:
[
  {"content": "concise fact or preference", "category": "fact|preference|context|task", "importance": 0.0-1.0}
]

Categories:
- fact: Factual information (names, dates, technical details)
- preference: User preferences (coding style, language, tools)
- context: Ongoing context (project details, goals)
- task: Tasks in progress or mentioned

Rules:
- Only extract genuinely important information
- Skip greetings, pleasantries, and generic responses
- importance 0.9-1.0: Critical facts (deadlines, key decisions)
- importance 0.6-0.8: Useful preferences and context
- importance 0.3-0.5: Background context
- Return empty array [] if nothing worth remembering
- Maximum 5 entries per conversation`
      };

      const { result } = await aiClient.runAgent(config, {
        task: 'extract_memories',
        conversation: conversationText,
      }, { maxTokens: 500 });

      const memories = Array.isArray(result) ? result : (result.memories || []);
      const stored = [];

      for (const mem of memories) {
        if (mem.content && mem.category && mem.importance > 0.2) {
          const id = this.store(mem.content, mem.category, mem.importance);
          stored.push({ id, ...mem });
        }
      }

      return stored;
    } catch (error) {
      console.error('[Memory] Extraction failed:', error.message);
      return [];
    }
  }

  /**
   * Build a context string for injection into system prompts.
   * @param {string} query - The user's current message for relevance matching
   * @returns {string} Formatted memory context
   */
  getContextForPrompt(query) {
    if (!query) return '';

    const memories = this.recall(query, 5);
    if (memories.length === 0) return '';

    const lines = memories.map(m =>
      `- [${m.category}] ${m.content} (importance: ${m.importance})`
    );

    return `\n\n--- Agent Memory ---\nRelevant past context:\n${lines.join('\n')}\n--- End Memory ---\n`;
  }
}

const agentMemory = new AgentMemory();
export default agentMemory;
