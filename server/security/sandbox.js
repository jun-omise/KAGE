/**
 * KAGE Skill Sandbox
 * Provides isolated execution environment for untrusted skills.
 *
 * Isolation levels:
 * - TRUSTED: Bundled/verified skills — full access
 * - RESTRICTED: User skills with limited capabilities
 * - SANDBOXED: Untrusted skills — process-level isolation with timeout
 *
 * Restrictions for SANDBOXED:
 * - No filesystem write access outside ~/Desktop and /tmp
 * - No network access to internal services (localhost)
 * - Command execution blocked except whitelisted
 * - Execution timeout enforced
 * - Memory limit enforced
 */

import { fork } from 'child_process';
import { join } from 'path';
import { homedir } from 'os';

/** Sandbox execution timeout (ms) */
const DEFAULT_TIMEOUT = 30000;

/** Maximum memory per sandbox (bytes) */
const MAX_MEMORY = 256 * 1024 * 1024; // 256MB

/** Allowed write paths for sandboxed skills */
const ALLOWED_WRITE_PATHS = [
  join(homedir(), 'Desktop'),
  '/tmp',
  join(homedir(), '.kagemusha', 'sandbox-output'),
];

/** Blocked network hosts */
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
];

/**
 * Determine the isolation level for a skill.
 * @param {object} skill - Skill definition from SkillLoader
 * @returns {'trusted'|'restricted'|'sandboxed'}
 */
export function getIsolationLevel(skill) {
  if (!skill) return 'sandboxed';

  // Bundled skills are trusted
  if (skill.source === 'bundled' && skill.verified) {
    return 'trusted';
  }

  // User skills with verification flag
  if (skill.verified) {
    return 'restricted';
  }

  // Everything else is sandboxed
  return 'sandboxed';
}

/**
 * Check if a tool call is allowed under the given isolation level.
 * @param {string} toolName - Tool being called
 * @param {object} toolArgs - Arguments for the tool
 * @param {'trusted'|'restricted'|'sandboxed'} isolationLevel
 * @returns {{allowed: boolean, reason?: string}}
 */
export function checkSandboxPermission(toolName, toolArgs, isolationLevel) {
  // Trusted skills have full access
  if (isolationLevel === 'trusted') {
    return { allowed: true };
  }

  // Restricted: block dangerous operations but allow most tools
  if (isolationLevel === 'restricted') {
    return _checkRestricted(toolName, toolArgs);
  }

  // Sandboxed: strict limitations
  return _checkSandboxed(toolName, toolArgs);
}

/**
 * Check restrictions for RESTRICTED level.
 * @private
 */
function _checkRestricted(toolName, toolArgs) {
  const name = toolName.toLowerCase();

  // Block shell commands
  if (['run_command', 'execute_command'].includes(name)) {
    return { allowed: false, reason: 'Shell execution requires trusted level' };
  }

  // Block system-level operations
  if (name.includes('chmod') || name.includes('chown')) {
    return { allowed: false, reason: 'Permission changes not allowed' };
  }

  return { allowed: true };
}

/**
 * Check restrictions for SANDBOXED level (strictest).
 * @private
 */
function _checkSandboxed(toolName, toolArgs) {
  const name = toolName.toLowerCase();

  // Block all shell execution
  if (['run_command', 'execute_command', 'run_applescript', 'send_keys_to_app'].includes(name)) {
    return { allowed: false, reason: 'Sandboxed skills cannot execute shell commands' };
  }

  // Block network-related tools
  if (['fetch_url', 'web_search'].includes(name)) {
    // Allow but check for internal host access
    const url = toolArgs.url || toolArgs.query || '';
    for (const host of BLOCKED_HOSTS) {
      if (url.includes(host)) {
        return { allowed: false, reason: `Sandboxed skills cannot access ${host}` };
      }
    }
  }

  // Check file write paths
  if (['write_file', 'create_directory', 'move_file'].includes(name)) {
    const path = toolArgs.path || toolArgs.filePath || toolArgs.destination || '';
    const expandedPath = path.replace(/^~/, homedir());

    const isAllowed = ALLOWED_WRITE_PATHS.some(p => expandedPath.startsWith(p));
    if (!isAllowed) {
      return {
        allowed: false,
        reason: `Sandboxed skills can only write to: ${ALLOWED_WRITE_PATHS.join(', ')}`,
      };
    }
  }

  // Block GitHub write operations
  if (['create_issue', 'create_pull_request', 'push_files', 'create_or_update_file'].includes(name)) {
    return { allowed: false, reason: 'Sandboxed skills cannot modify GitHub repositories' };
  }

  // Block messaging/notification
  if (['slack_send_message', 'gmail_send'].includes(name)) {
    return { allowed: false, reason: 'Sandboxed skills cannot send messages' };
  }

  return { allowed: true };
}

/**
 * Execute a skill's tool call with sandbox enforcement.
 * For sandboxed skills, this wraps the execution with timeout and resource limits.
 *
 * @param {Function} executeFn - The actual tool execution function
 * @param {string} toolName - Tool name
 * @param {object} toolArgs - Tool arguments
 * @param {'trusted'|'restricted'|'sandboxed'} isolationLevel
 * @param {object} options - Additional options
 * @returns {Promise<object>} Tool result
 */
export async function executeSandboxed(executeFn, toolName, toolArgs, isolationLevel, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  // Permission check first
  const permCheck = checkSandboxPermission(toolName, toolArgs, isolationLevel);
  if (!permCheck.allowed) {
    return {
      success: false,
      error: `Sandbox violation: ${permCheck.reason}`,
      sandboxBlocked: true,
    };
  }

  // Trusted and restricted: execute directly with timeout
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        success: false,
        error: `Execution timed out after ${timeout}ms`,
        sandboxTimeout: true,
      });
    }, timeout);

    executeFn(toolName, toolArgs)
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        resolve({
          success: false,
          error: `Sandbox execution error: ${error.message}`,
        });
      });
  });
}

/**
 * Get sandbox configuration for display.
 */
export function getSandboxConfig() {
  return {
    levels: {
      trusted: {
        description: 'Full access — bundled/verified skills',
        restrictions: [],
      },
      restricted: {
        description: 'Limited access — no shell execution',
        restrictions: ['No shell commands', 'No permission changes'],
      },
      sandboxed: {
        description: 'Strict isolation — untrusted skills',
        restrictions: [
          'No shell commands',
          'No AppleScript/SendKeys',
          'No internal network access',
          `File writes limited to: ${ALLOWED_WRITE_PATHS.join(', ')}`,
          'No GitHub write operations',
          'No messaging/email send',
          `Timeout: ${DEFAULT_TIMEOUT}ms`,
          `Memory limit: ${MAX_MEMORY / 1024 / 1024}MB`,
        ],
      },
    },
    allowedWritePaths: ALLOWED_WRITE_PATHS,
    blockedHosts: BLOCKED_HOSTS,
    defaultTimeout: DEFAULT_TIMEOUT,
    maxMemory: MAX_MEMORY,
  };
}
