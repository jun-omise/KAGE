/**
 * KAGE Auto MCP Resolver
 * Automatically detects and connects required MCP servers based on
 * user messages and planner output.
 */

import mcpManager from './client.js';
import suggestionEngine from './suggestion-engine.js';
import { BUILTIN_MCP_SERVERS } from './builtin-servers.js';
import { resolveServerId } from './tool-server-map.js';
import sseManager from '../core/sse-manager.js';
import { getDb } from '../db/init.js';

export class AutoMCPResolver {
  constructor() {
    this._builtinIndex = new Map();
    for (const server of BUILTIN_MCP_SERVERS) {
      this._builtinIndex.set(server.id, server);
    }
  }

  /**
   * Resolve MCP servers needed for a user message (pre-planning).
   * Uses keyword matching from suggestion engine.
   */
  async resolveForMessage(message, conversationId) {
    const serverIds = suggestionEngine.suggestServerIds(message);
    const connected = [];

    for (const serverId of serverIds) {
      if (mcpManager.isServerConnected(serverId)) continue;

      const result = await this.autoConnect(serverId, conversationId);
      if (result.success) {
        connected.push(serverId);
        suggestionEngine.addSessionHistory(serverId);
      }
    }

    return connected;
  }

  /**
   * Resolve MCP servers needed by the planner's output.
   * Scans plan.subtasks[].tools for required tool names.
   */
  async resolveForPlan(plan, conversationId) {
    if (!plan?.subtasks) return [];

    const neededServerIds = new Set();

    for (const subtask of plan.subtasks) {
      if (!subtask.tools) continue;
      for (const toolName of subtask.tools) {
        const serverId = resolveServerId(toolName);
        if (serverId && !mcpManager.isServerConnected(serverId)) {
          neededServerIds.add(serverId);
        }
      }
    }

    const connected = [];
    for (const serverId of neededServerIds) {
      const result = await this.autoConnect(serverId, conversationId);
      if (result.success) {
        connected.push(serverId);
        suggestionEngine.addSessionHistory(serverId);
      }
    }

    return connected;
  }

  /**
   * Auto-connect a server by ID.
   * Looks up config from builtin-servers, resolves env, and connects.
   */
  async autoConnect(serverId, conversationId) {
    const serverConfig = this._builtinIndex.get(serverId);
    if (!serverConfig) {
      return { success: false, reason: `Unknown server: ${serverId}` };
    }

    // Check if required env keys are available
    if (serverConfig.envKeys?.length > 0) {
      const resolvedEnv = this._getEnvForServer(serverConfig);
      const missingKeys = serverConfig.envKeys.filter(key => !resolvedEnv[key]);

      if (missingKeys.length > 0) {
        // Emit event telling UI that env keys are needed
        if (conversationId) {
          sseManager.send(conversationId, 'mcp:env_required', {
            serverId,
            serverName: serverConfig.name,
            missingKeys,
          });
        }
        return { success: false, reason: `Missing env keys: ${missingKeys.join(', ')}` };
      }
    }

    // Emit connecting event
    if (conversationId) {
      sseManager.send(conversationId, 'mcp:auto_connecting', {
        serverId,
        serverName: serverConfig.name,
      });
    }

    try {
      // Build the config with resolved env
      const connectConfig = {
        ...serverConfig,
        env: this._getEnvForServer(serverConfig),
      };

      const tools = await mcpManager.connectServer(connectConfig);

      if (conversationId) {
        sseManager.send(conversationId, 'mcp:auto_connected', {
          serverId,
          serverName: serverConfig.name,
          tools: tools.map(t => t.name),
        });
      }

      return { success: true, tools };
    } catch (error) {
      if (conversationId) {
        sseManager.send(conversationId, 'mcp:auto_failed', {
          serverId,
          serverName: serverConfig.name,
          error: error.message,
        });
      }
      return { success: false, reason: error.message };
    }
  }

  /**
   * Resolve environment variables for a server.
   * Checks: 1) tool_configs table in DB, 2) process.env
   */
  _getEnvForServer(serverConfig) {
    const resolved = {};

    if (!serverConfig.envKeys || serverConfig.envKeys.length === 0) {
      return resolved;
    }

    for (const key of serverConfig.envKeys) {
      // Try DB first (tool_configs table)
      try {
        const db = getDb();
        const row = db.prepare(
          "SELECT value FROM tool_configs WHERE server_id = ? AND key = ?"
        ).get(serverConfig.id, key);
        if (row?.value) {
          resolved[key] = row.value;
          continue;
        }
      } catch {}

      // Try config table
      try {
        const db = getDb();
        const row = db.prepare(
          "SELECT value FROM config WHERE key = ?"
        ).get(key.toLowerCase());
        if (row?.value) {
          resolved[key] = row.value;
          continue;
        }
      } catch {}

      // Fall back to process.env
      if (process.env[key]) {
        resolved[key] = process.env[key];
      }
    }

    return resolved;
  }
}

// Singleton
const autoResolver = new AutoMCPResolver();
export default autoResolver;
