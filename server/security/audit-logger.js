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
  query({ type, dateFrom, dateTo, limit = 50, offset = 0 } = {}) {
    try {
      const db = getDb();
      const conditions = [];
      const params = [];

      if (type) {
        conditions.push('event_type = ?');
        params.push(type);
      }
      if (dateFrom) {
        conditions.push('created_at >= ?');
        params.push(dateFrom);
      }
      if (dateTo) {
        conditions.push('created_at <= ?');
        params.push(dateTo);
      }

      let sql = 'SELECT * FROM security_events';
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = db.prepare(sql).all(...params);
      return rows.map((row) => ({
        ...row,
        details: row.details ? JSON.parse(row.details) : {},
      }));
    } catch (err) {
      console.error('AuditLogger query error:', err.message);
      return [];
    }
  }

  /**
   * Alias for backward compatibility.
   */
  getEvents(options) {
    return this.query(options);
  }

  /**
   * Export audit events in JSON or CSV format.
   * @param {'json'|'csv'} format - Export format
   * @param {object} [filter] - Optional query filter
   * @returns {string} Formatted export string
   */
  export(format = 'json', filter = {}) {
    const events = this.query({ ...filter, limit: 10000 });

    if (format === 'csv') {
      const header = 'id,event_type,agent,details,created_at';
      const rows = events.map(e =>
        `"${e.id}","${e.event_type}","${e.agent || ''}","${JSON.stringify(e.details).replace(/"/g, '""')}","${e.created_at}"`
      );
      return [header, ...rows].join('\n');
    }

    return JSON.stringify(events, null, 2);
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
