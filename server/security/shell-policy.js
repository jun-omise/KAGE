/**
 * KAGE Shell Command Policy Engine
 * Controls which shell commands can be executed, with whitelist/blacklist
 * and approval flow for dangerous operations.
 *
 * Three tiers:
 * - ALLOWED: Auto-approved, safe read-only commands
 * - APPROVAL_REQUIRED: Needs user confirmation before execution
 * - BLOCKED: Never executed, always denied
 */

import { getDb } from '../db/init.js';

/** Commands that are always safe to run (read-only, non-destructive) */
const DEFAULT_WHITELIST = [
  'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'find', 'which', 'whoami',
  'pwd', 'date', 'echo', 'env', 'printenv', 'uname', 'df', 'du',
  'file', 'stat', 'readlink', 'basename', 'dirname',
  'node', 'npm', 'npx', 'python', 'python3', 'pip', 'pip3',
  'git', 'gh',
  'curl', 'wget',  // network reads
  'jq', 'sed', 'awk', 'sort', 'uniq', 'cut', 'tr', 'tee',
  'open', 'xdg-open',  // open files with default app
  'brew', 'apt', 'yum', // package managers (install is separate approval)
];

/** Commands that ALWAYS require user approval before execution */
const APPROVAL_REQUIRED = [
  'rm', 'rmdir', 'mv',   // destructive file operations
  'chmod', 'chown',       // permission changes
  'kill', 'killall',      // process termination
  'shutdown', 'reboot',   // system state
  'docker', 'podman',     // container operations
  'ssh', 'scp',           // remote access
  'sudo', 'su',           // privilege escalation
  'crontab',              // system cron
  'systemctl', 'service', // system services
  'iptables', 'ufw',      // firewall
  'mount', 'umount',      // filesystems
  'mkfs', 'fdisk',        // disk operations
  'dd',                   // raw disk write
];

/** Commands that are ALWAYS blocked, never executed */
const BLOCKED_COMMANDS = [
  'rm -rf /',     // catastrophic
  'rm -rf /*',
  'mkfs',
  'dd if=/dev/zero',
  'dd if=/dev/random',
  ':(){ :|:& };:', // fork bomb
  'wget -O- | sh',
  'curl | sh',
  'curl | bash',
];

/** Dangerous patterns (regex) that trigger approval regardless of command */
const DANGEROUS_PATTERNS = [
  /rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?\//, // rm with root-level paths
  />\s*\/dev\//, // write to device files
  /chmod\s+777/, // world-writable permissions
  /chmod\s+-R/, // recursive permission change
  /sudo\s+/, // any sudo usage
  /\|\s*sh\b/, // piping to shell
  /\|\s*bash\b/,
  /eval\s*\(/, // eval usage
  /`.*`/, // command substitution (backticks)
  /\$\(.*\)/, // command substitution
  /;\s*rm\s/, // chained rm
  /&&\s*rm\s/, // chained rm
  />\s*\/etc\//, // writing to system config
  />\s*\/usr\//, // writing to system dirs
  />\s*\/bin\//, // writing to system dirs
];

/**
 * Analyze a shell command and return the policy decision.
 * @param {string} command - The full command string
 * @returns {{
 *   allowed: boolean,
 *   requiresApproval: boolean,
 *   blocked: boolean,
 *   reason: string,
 *   riskLevel: 'safe'|'moderate'|'dangerous'|'blocked',
 *   baseCommand: string
 * }}
 */
export function analyzeCommand(command) {
  if (!command || typeof command !== 'string') {
    return { allowed: false, requiresApproval: false, blocked: true, reason: 'Empty command', riskLevel: 'blocked', baseCommand: '' };
  }

  const trimmed = command.trim();

  // Check blocked commands first
  for (const blocked of BLOCKED_COMMANDS) {
    if (trimmed.includes(blocked)) {
      return {
        allowed: false,
        requiresApproval: false,
        blocked: true,
        reason: `Blocked: "${blocked}" is a prohibited command pattern`,
        riskLevel: 'blocked',
        baseCommand: trimmed.split(/\s/)[0],
      };
    }
  }

  // Check dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        requiresApproval: true,
        blocked: false,
        reason: `Dangerous pattern detected: ${pattern.toString()}`,
        riskLevel: 'dangerous',
        baseCommand: trimmed.split(/\s/)[0],
      };
    }
  }

  // Extract base command (handle pipes, chains)
  const commands = extractCommands(trimmed);

  // Check all commands in the chain
  let maxRisk = 'safe';
  let approvalNeeded = false;
  let blockReason = null;

  for (const cmd of commands) {
    const baseCmd = cmd.split(/\s/)[0].replace(/^\.\//, '');

    // Check if custom policy exists in DB
    const customPolicy = getCustomPolicy(baseCmd);
    if (customPolicy) {
      if (customPolicy === 'blocked') {
        return {
          allowed: false, requiresApproval: false, blocked: true,
          reason: `"${baseCmd}" is blocked by custom policy`,
          riskLevel: 'blocked', baseCommand: baseCmd,
        };
      }
      if (customPolicy === 'approval') {
        approvalNeeded = true;
        maxRisk = 'dangerous';
        continue;
      }
      if (customPolicy === 'allowed') {
        continue; // Explicitly allowed
      }
    }

    // Check blocked list
    if (BLOCKED_COMMANDS.some(b => cmd.includes(b))) {
      return {
        allowed: false, requiresApproval: false, blocked: true,
        reason: `"${baseCmd}" is a blocked command`,
        riskLevel: 'blocked', baseCommand: baseCmd,
      };
    }

    // Check approval-required list
    if (APPROVAL_REQUIRED.includes(baseCmd)) {
      approvalNeeded = true;
      maxRisk = 'dangerous';
      continue;
    }

    // Check whitelist
    if (!DEFAULT_WHITELIST.includes(baseCmd)) {
      // Unknown command — require approval
      approvalNeeded = true;
      if (maxRisk === 'safe') maxRisk = 'moderate';
    }
  }

  if (approvalNeeded) {
    return {
      allowed: false,
      requiresApproval: true,
      blocked: false,
      reason: `Command requires approval: ${commands.join(' | ')}`,
      riskLevel: maxRisk,
      baseCommand: commands[0].split(/\s/)[0],
    };
  }

  return {
    allowed: true,
    requiresApproval: false,
    blocked: false,
    reason: 'Command is in the whitelist',
    riskLevel: 'safe',
    baseCommand: commands[0].split(/\s/)[0],
  };
}

/**
 * Extract individual commands from a complex command string.
 * Handles pipes (|), chains (&&, ||, ;), and subshells.
 * @param {string} commandStr
 * @returns {string[]}
 */
function extractCommands(commandStr) {
  // Split by pipe, &&, ||, ;
  const parts = commandStr.split(/\s*[|;&]+\s*/);
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

/**
 * Get custom shell policy from database.
 * @param {string} command - Base command name
 * @returns {'allowed'|'approval'|'blocked'|null}
 */
function getCustomPolicy(command) {
  try {
    const db = getDb();
    const row = db.prepare(
      "SELECT value FROM config WHERE key = ?"
    ).get(`shell_policy_${command}`);

    if (row) return row.value;
  } catch {
    // DB not available
  }
  return null;
}

/**
 * Set a custom shell policy for a command.
 * @param {string} command - Base command name
 * @param {'allowed'|'approval'|'blocked'} policy
 */
export function setCustomPolicy(command, policy) {
  const db = getDb();
  db.prepare(`
    INSERT INTO config (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
  `).run(`shell_policy_${command}`, policy, policy);
}

/**
 * Get all custom shell policies.
 * @returns {Array<{command: string, policy: string}>}
 */
export function getCustomPolicies() {
  try {
    const db = getDb();
    const rows = db.prepare(
      "SELECT key, value FROM config WHERE key LIKE 'shell_policy_%'"
    ).all();

    return rows.map(r => ({
      command: r.key.replace('shell_policy_', ''),
      policy: r.value,
    }));
  } catch {
    return [];
  }
}

/**
 * Get the full shell policy configuration.
 */
export function getShellPolicy() {
  return {
    whitelist: [...DEFAULT_WHITELIST],
    approvalRequired: [...APPROVAL_REQUIRED],
    blocked: [...BLOCKED_COMMANDS],
    dangerousPatterns: DANGEROUS_PATTERNS.map(p => p.toString()),
    customPolicies: getCustomPolicies(),
  };
}
