import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.KAGE_DB_PATH || join(__dirname, 'kage.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT REFERENCES conversations(id),
      role TEXT CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      attachments JSON,
      agent_trace JSON,
      cost REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT CHECK(trigger_type IN ('cron', 'webhook', 'manual', 'event')),
      trigger_config JSON,
      plan JSON,
      permissions JSON,
      settings JSON,
      status TEXT DEFAULT 'active',
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_runs (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id),
      status TEXT CHECK(status IN ('running', 'completed', 'success', 'failed', 'cancelled')),
      result JSON,
      cost REAL DEFAULT 0,
      duration_ms INTEGER,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS tool_configs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('builtin', 'custom')),
      config JSON,
      permissions JSON,
      enabled BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS security_events (
      id TEXT PRIMARY KEY,
      event_type TEXT,
      agent TEXT,
      details JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      category TEXT,
      importance REAL DEFAULT 0.5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
      access_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cost_tracking (
      id TEXT PRIMARY KEY,
      date TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      task_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notification_channels (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('webhook', 'line', 'whatsapp', 'messenger')),
      name TEXT NOT NULL,
      config JSON NOT NULL,
      enabled BOOLEAN DEFAULT 0,
      event_filters JSON,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_log (
      id TEXT PRIMARY KEY,
      channel_id TEXT REFERENCES notification_channels(id),
      event_type TEXT,
      payload JSON,
      status TEXT CHECK(status IN ('sent', 'failed', 'pending')),
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messaging_sessions (
      id TEXT PRIMARY KEY,
      platform TEXT CHECK(platform IN ('line', 'whatsapp', 'messenger')),
      platform_user_id TEXT NOT NULL,
      authenticated BOOLEAN DEFAULT 0,
      conversation_id TEXT REFERENCES conversations(id),
      rate_limit_count INTEGER DEFAULT 0,
      rate_limit_reset DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_task_runs_task ON task_runs(task_id);
    CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_cost_tracking_date ON cost_tracking(date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_messaging_session_user ON messaging_sessions(platform, platform_user_id);
  `);

  // Migration: add attachments column if missing
  try {
    db.prepare("SELECT attachments FROM messages LIMIT 0").get();
  } catch {
    db.exec("ALTER TABLE messages ADD COLUMN attachments JSON");
  }

  // Migration: add status column to tasks if missing
  try {
    db.prepare("SELECT status FROM tasks LIMIT 0").get();
  } catch {
    db.exec("ALTER TABLE tasks ADD COLUMN status TEXT DEFAULT 'active'");
  }

  // Migration: add template columns to tasks
  try {
    db.prepare("SELECT template_text FROM tasks LIMIT 0").get();
  } catch {
    db.exec("ALTER TABLE tasks ADD COLUMN template_text TEXT");
  }
  try {
    db.prepare("SELECT variables FROM tasks LIMIT 0").get();
  } catch {
    db.exec("ALTER TABLE tasks ADD COLUMN variables JSON");
  }
  try {
    db.prepare("SELECT source_message_id FROM tasks LIMIT 0").get();
  } catch {
    db.exec("ALTER TABLE tasks ADD COLUMN source_message_id TEXT");
  }
  try {
    db.prepare("SELECT is_template FROM tasks LIMIT 0").get();
  } catch {
    db.exec("ALTER TABLE tasks ADD COLUMN is_template BOOLEAN DEFAULT 0");
  }

  // Migration: add server_id and key to tool_configs for env storage
  try {
    db.prepare("SELECT server_id FROM tool_configs LIMIT 0").get();
  } catch {
    db.exec("ALTER TABLE tool_configs ADD COLUMN server_id TEXT");
    db.exec("ALTER TABLE tool_configs ADD COLUMN key TEXT");
    db.exec("ALTER TABLE tool_configs ADD COLUMN value TEXT");
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
