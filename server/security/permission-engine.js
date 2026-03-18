/**
 * PermissionEngine — tool-level permission checking with 3-tier policy.
 *
 * Policies:
 *   auto_approve  — automatic approval (default for read operations)
 *   ask_first     — ask on first use, then remember (for external API)
 *   always_ask    — always require confirmation (write/delete/shell)
 */
import { getDb } from '../db/init.js';

const DEFAULT_POLICIES = {
  read_operations: 'auto_approve',
  write_operations: 'always_ask',
  delete_operations: 'always_ask',
  external_api: 'ask_first',
  shell_commands: 'always_ask',
  browser_actions: 'ask_first',
};

// Tool name → category classification keywords
const CATEGORY_PATTERNS = {
  read_operations: ['read', 'list', 'get', 'search', 'query', 'fetch', 'find', 'describe', 'show', 'view', 'browse', 'inspect'],
  write_operations: ['write', 'create', 'update', 'set', 'put', 'post', 'save', 'insert', 'add', 'append', 'generate', 'edit', 'modify'],
  delete_operations: ['delete', 'remove', 'drop', 'destroy', 'purge', 'truncate', 'clear', 'erase', 'unlink'],
  shell_commands: ['run_command', 'execute_command', 'shell', 'exec', 'terminal', 'bash'],
  browser_actions: ['browser', 'navigate', 'click', 'screenshot', 'puppeteer', 'playwright'],
};

// In-memory cache of "ask_first" approvals within this session
const sessionApprovals = new Map();

/**
 * Classify a tool name into an operation category.
 */
function classifyTool(toolName) {
  const lower = (toolName || '').toLowerCase();

  // Check shell commands first (highest specificity)
  for (const kw of CATEGORY_PATTERNS.shell_commands) {
    if (lower.includes(kw)) return 'shell_commands';
  }

  // Check browser actions
  for (const kw of CATEGORY_PATTERNS.browser_actions) {
    if (lower.includes(kw)) return 'browser_actions';
  }

  // Check delete before write (delete keywords are more specific)
  for (const kw of CATEGORY_PATTERNS.delete_operations) {
    if (lower.includes(kw)) return 'delete_operations';
  }

  // Check write
  for (const kw of CATEGORY_PATTERNS.write_operations) {
    if (lower.includes(kw)) return 'write_operations';
  }

  // Check read
  for (const kw of CATEGORY_PATTERNS.read_operations) {
    if (lower.includes(kw)) return 'read_operations';
  }

  // Default: treat unknown tools as external_api (safe-side)
  return 'external_api';
}

/**
 * Load permission policies from DB, merging with defaults.
 */
function getPolicies() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'security_config'").get();
    if (row) {
      const config = JSON.parse(row.value);
      // Map from the UI format (permissions.read/write/delete/external) to policy format
      const perms = config.permissions || {};
      const mapped = { ...DEFAULT_POLICIES };

      if (perms.read === 'auto' || perms.auto_approve_read) mapped.read_operations = 'auto_approve';
      else if (perms.read === 'first') mapped.read_operations = 'ask_first';
      else if (perms.read === 'confirm') mapped.read_operations = 'always_ask';

      if (perms.write === 'auto' || perms.auto_approve_write) mapped.write_operations = 'auto_approve';
      else if (perms.write === 'first') mapped.write_operations = 'ask_first';
      else if (perms.write === 'confirm') mapped.write_operations = 'always_ask';

      if (perms.delete === 'auto' || perms.auto_approve_delete) mapped.delete_operations = 'auto_approve';
      else if (perms.delete === 'first') mapped.delete_operations = 'ask_first';
      else if (perms.delete === 'confirm') mapped.delete_operations = 'always_ask';

      if (perms.external === 'auto' || perms.auto_approve_external) mapped.external_api = 'auto_approve';
      else if (perms.external === 'first') mapped.external_api = 'ask_first';
      else if (perms.external === 'confirm') mapped.external_api = 'always_ask';

      return mapped;
    }
  } catch {}
  return { ...DEFAULT_POLICIES };
}

/**
 * Check permission for a tool call.
 * @param {string} toolName — MCP tool name
 * @param {object} args — tool arguments
 * @param {object} [config] — optional override config
 * @returns {{ allowed: boolean, requiresApproval: boolean, reason: string|null, category: string }}
 */
export function checkPermission(toolName, args = {}, config = null) {
  const category = classifyTool(toolName);
  const policies = config || getPolicies();
  const policy = policies[category] || 'always_ask';

  switch (policy) {
    case 'auto_approve':
      return { allowed: true, requiresApproval: false, reason: null, category };

    case 'ask_first': {
      // Check if this tool was already approved in this session
      const sessionKey = `${toolName}`;
      if (sessionApprovals.has(sessionKey)) {
        return { allowed: true, requiresApproval: false, reason: null, category };
      }
      // Check persistent approvals in DB
      try {
        const db = getDb();
        const row = db.prepare(
          "SELECT id FROM approval_queue WHERE action_type = ? AND status = 'approved' ORDER BY resolved_at DESC LIMIT 1"
        ).get(`auto:${toolName}`);
        if (row) {
          sessionApprovals.set(sessionKey, true);
          return { allowed: true, requiresApproval: false, reason: null, category };
        }
      } catch {}
      return {
        allowed: false,
        requiresApproval: true,
        reason: `First use of "${toolName}" (${category}) requires approval`,
        category,
      };
    }

    case 'always_ask':
      return {
        allowed: false,
        requiresApproval: true,
        reason: `"${toolName}" (${category}) requires approval`,
        category,
      };

    default:
      return { allowed: false, requiresApproval: true, reason: `Unknown policy: ${policy}`, category };
  }
}

/**
 * Record an approval decision. For ask_first, remembers the decision.
 * @param {string} toolName — MCP tool name
 * @param {boolean} approved — whether the tool was approved
 */
export function recordApproval(toolName, approved) {
  if (approved) {
    sessionApprovals.set(toolName, true);
    // Persist for ask_first tools
    try {
      const db = getDb();
      const id = `auto_${toolName}_${Date.now()}`;
      db.prepare(
        "INSERT INTO approval_queue (id, action_type, action_details, status, resolved_at) VALUES (?, ?, ?, 'approved', datetime('now'))"
      ).run(id, `auto:${toolName}`, JSON.stringify({ tool: toolName, auto_approved: true }));
    } catch {}
  }
}

/**
 * Synchronous version of recordApproval (no dynamic import).
 */
export function recordApprovalSync(toolName, approved) {
  if (approved) {
    sessionApprovals.set(toolName, true);
  }
}

/**
 * Get the current policies.
 */
export function getPermissionPolicies() {
  return getPolicies();
}

/**
 * Get the category for a tool.
 */
export { classifyTool };
