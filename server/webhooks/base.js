import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';
import orchestrator from '../core/orchestrator.js';
import bcrypt from 'bcryptjs';

export class WebhookHandler {
  constructor(platform) {
    this.platform = platform;
  }

  async getOrCreateSession(platformUserId) {
    const db = getDb();
    let session = db.prepare(
      'SELECT * FROM messaging_sessions WHERE platform = ? AND platform_user_id = ?'
    ).get(this.platform, platformUserId);

    if (!session) {
      const id = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO messaging_sessions (id, platform, platform_user_id, created_at, last_active) VALUES (?, ?, ?, ?, ?)'
      ).run(id, this.platform, platformUserId, now, now);
      session = db.prepare('SELECT * FROM messaging_sessions WHERE id = ?').get(id);
    }

    // Update last_active
    db.prepare('UPDATE messaging_sessions SET last_active = ? WHERE id = ?')
      .run(new Date().toISOString(), session.id);

    return session;
  }

  async checkRateLimit(session) {
    const db = getDb();
    const now = new Date();
    const resetTime = session.rate_limit_reset ? new Date(session.rate_limit_reset) : null;

    if (!resetTime || now > resetTime) {
      // Reset the counter
      const newReset = new Date(now.getTime() + 3600000).toISOString(); // 1 hour
      db.prepare('UPDATE messaging_sessions SET rate_limit_count = 1, rate_limit_reset = ? WHERE id = ?')
        .run(newReset, session.id);
      return true;
    }

    if (session.rate_limit_count >= 30) {
      return false; // Rate limited
    }

    db.prepare('UPDATE messaging_sessions SET rate_limit_count = rate_limit_count + 1 WHERE id = ?')
      .run(session.id);
    return true;
  }

  async authenticate(session, message) {
    if (session.authenticated) return true;

    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'passphrase_hash'").get();
    if (!row) return false;

    const valid = await bcrypt.compare(message.trim(), row.value);
    if (valid) {
      // Create conversation for this session
      const convId = uuidv4();
      const now = new Date().toISOString();
      db.prepare(
        'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
      ).run(convId, `${this.platform} - ${session.platform_user_id}`, now, now);

      db.prepare('UPDATE messaging_sessions SET authenticated = 1, conversation_id = ? WHERE id = ?')
        .run(convId, session.id);

      return true;
    }
    return false;
  }

  async processCommand(text, session) {
    if (!session.conversation_id) return 'Session error. Please re-authenticate.';

    try {
      const result = await orchestrator.processMessage({
        conversationId: session.conversation_id,
        messageId: uuidv4(),
        message: text,
      });
      return result.response || 'Task completed.';
    } catch (err) {
      console.error(`${this.platform} command error:`, err);
      return `Error: ${err.message}`;
    }
  }

  truncateResponse(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  }
}
