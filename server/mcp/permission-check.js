import { getSecurityConfig } from '../security/config.js';
import { getDb } from '../db/init.js';

export function checkPermission(toolName, toolPermissions, action) {
  const db = getDb();
  const config = getSecurityConfig(db);
  const perms = config.permissions;

  if (action === 'read' && perms.auto_approve_read) return { allowed: true };
  if (action === 'write' && perms.auto_approve_write) return { allowed: true };
  if (action === 'delete' && perms.auto_approve_delete) return { allowed: true };
  if (action === 'external' && perms.auto_approve_external) return { allowed: true };

  return {
    allowed: false,
    reason: `Permission required: ${action} for tool ${toolName}`,
    requires_approval: true,
  };
}

export function inferAction(toolName) {
  const name = toolName.toLowerCase();
  if (name.includes('delete') || name.includes('remove')) return 'delete';
  if (name.includes('write') || name.includes('create') || name.includes('update') || name.includes('send')) return 'write';
  if (name.includes('search') || name.includes('fetch') || name.includes('call')) return 'external';
  return 'read';
}
