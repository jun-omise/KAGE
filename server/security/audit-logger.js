import { randomUUID } from 'node:crypto';
import { getDb } from '../db/init.js';

const VALID_EVENT_TYPES = [
  'blocked',
  'approved',
  'alert',
  'cost_limit',
  'pii_detected',
  'tool_call',
  'agent_action',
];

export class AuditLogger {
  /**
   * Log a security event to the security_events table.
   * @param {string} eventType - One of the valid event types
   * @param {object} details - Additional event details (may include agent field)
   * @returns {string|null} The event ID, or null on failure
   */
  log(eventType, details = {}) {
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      console.warn(`AuditLogger: invalid event type "${eventType}", skipping`);
      return null;
    }

    try {
      const db = getDb();
      const eventId = randomUUID();
      const agent = details.agent || 'system';
      db.prepare(
        "INSERT INTO security_events (id, event_type, agent, details, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      ).run(eventId, eventType, agent, JSON.stringify(details));
      return eventId;
    } catch (err) {
      console.error('AuditLogger error:', err.message);
      return null;
    }
  }

  /**
   * Query security events with optional filters.
   * @param {object} options - Query options
   * @returns {Array} Array of event objects
   */
  getEvents({ type, limit = 50, offset = 0 } = {}) {
    try {
      const db = getDb();
      let query = 'SELECT * FROM security_events';
      const params = [];

      if (type) {
        query += ' WHERE event_type = ?';
        params.push(type);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = db.prepare(query).all(...params);
      return rows.map((row) => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
      }));
    } catch (err) {
      console.error('AuditLogger getEvents error:', err.message);
      return [];
    }
  }

  /**
   * Delete events older than the specified retention period.
   * @param {number} retentionDays - Number of days to retain
   * @returns {number} Number of deleted events
   */
  cleanup(retentionDays = 30) {
    try {
      const db = getDb();
      const result = db.prepare(
        "DELETE FROM security_events WHERE created_at < datetime('now', ?)"
      ).run(`-${retentionDays} days`);
      return result.changes;
    } catch (err) {
      console.error('AuditLogger cleanup error:', err.message);
      return 0;
    }
  }
}
