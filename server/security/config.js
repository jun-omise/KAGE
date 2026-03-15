export const DEFAULT_SECURITY_CONFIG = {
  cost: {
    per_task_limit: 1.00,
    daily_limit: 10.00,
    monthly_limit: 100.00,
    alert_threshold: 0.80,
  },
  permissions: {
    auto_approve_read: true,
    auto_approve_write: false,
    auto_approve_delete: false,
    auto_approve_external: false,
  },
  loop_detection: {
    max_same_tool_calls: 10,
    max_agent_bounces: 10,
    max_task_duration_ms: 300000,
    max_tokens_per_task: 200000,
  },
  pii_protection: {
    enabled: true,
    patterns: ['credit_card', 'ssn', 'phone', 'email', 'api_key'],
    action: 'mask',
  },
  audit: {
    enabled: true,
    log_tool_calls: true,
    log_agent_thoughts: true,
    log_costs: true,
    retention_days: 30,
  },
};

export function getSecurityConfig(db) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('security_config');
  if (row) return JSON.parse(row.value);
  return DEFAULT_SECURITY_CONFIG;
}

export function updateSecurityConfig(db, config) {
  const merged = { ...DEFAULT_SECURITY_CONFIG, ...config };
  db.prepare('INSERT OR REPLACE INTO config (key, value, updated_at) VALUES (?, ?, datetime(\'now\'))').run('security_config', JSON.stringify(merged));
  return merged;
}
