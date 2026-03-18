import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const MAX_RECONNECT_RETRIES = 3;
const RECONNECT_DELAY_MS = 2000;

class MCPManager {
  constructor() {
    this.clients = new Map();
    this.toolRegistry = new Map();
    this.serverConfigs = new Map(); // Store configs for reconnection
  }

  async connectServer(serverConfig, { retryCount = 0 } = {}) {
    try {
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: { ...process.env, ...this.resolveEnv(serverConfig.env) },
      });

      const client = new Client({
        name: 'kage',
        version: '1.0.0',
      });

      await client.connect(transport);

      const tools = await client.listTools();
      for (const tool of tools.tools) {
        this.toolRegistry.set(tool.name, {
          serverId: serverConfig.id,
          schema: tool.inputSchema,
          description: tool.description,
          permissions: serverConfig.permissions,
        });
      }

      this.clients.set(serverConfig.id, client);
      this.serverConfigs.set(serverConfig.id, serverConfig);

      // Monitor for disconnection and auto-reconnect
      this._watchConnection(serverConfig.id);

      return tools.tools;
    } catch (error) {
      // Auto-reconnect with retry
      if (retryCount < MAX_RECONNECT_RETRIES) {
        console.warn(`[MCP] Connection to ${serverConfig.id} failed (attempt ${retryCount + 1}/${MAX_RECONNECT_RETRIES}): ${error.message}`);
        await new Promise(r => setTimeout(r, RECONNECT_DELAY_MS * (retryCount + 1)));
        return this.connectServer(serverConfig, { retryCount: retryCount + 1 });
      }
      // Clean up partial state
      this.clients.delete(serverConfig.id);
      for (const [name, info] of this.toolRegistry) {
        if (info.serverId === serverConfig.id) this.toolRegistry.delete(name);
      }
      throw new Error(`Failed to connect to ${serverConfig.id} after ${MAX_RECONNECT_RETRIES} attempts: ${error.message}`);
    }
  }

  /**
   * Watch a connected server and attempt reconnection on disconnect
   */
  _watchConnection(serverId) {
    const client = this.clients.get(serverId);
    if (!client) return;

    const onClose = async () => {
      console.warn(`[MCP] Server ${serverId} disconnected, attempting reconnection...`);
      this.clients.delete(serverId);
      // Remove tools from this server
      for (const [name, info] of this.toolRegistry) {
        if (info.serverId === serverId) this.toolRegistry.delete(name);
      }
      // Attempt reconnection
      const config = this.serverConfigs.get(serverId);
      if (config) {
        try {
          await this.connectServer(config);
          console.log(`[MCP] Successfully reconnected to ${serverId}`);
        } catch (e) {
          console.error(`[MCP] Failed to reconnect to ${serverId}: ${e.message}`);
        }
      }
    };

    // Listen for transport close events
    if (client.transport && typeof client.transport.onclose === 'function') {
      const origOnClose = client.transport.onclose;
      client.transport.onclose = () => {
        if (origOnClose) origOnClose();
        onClose();
      };
    }
  }

  async callTool(toolName, args) {
    const toolInfo = this.toolRegistry.get(toolName);
    if (!toolInfo) throw new Error(`Unknown tool: ${toolName}`);

    const client = this.clients.get(toolInfo.serverId);
    if (!client) throw new Error(`Server not connected: ${toolInfo.serverId}`);

    return client.callTool({ name: toolName, arguments: args });
  }

  getToolDefinitions(allowedPermissions) {
    const tools = [];
    for (const [name, info] of this.toolRegistry) {
      if (this.isPermitted(info.permissions, allowedPermissions)) {
        tools.push({
          name,
          description: info.description,
          input_schema: info.schema,
        });
      }
    }
    return tools;
  }

  isPermitted(toolPermissions, allowedPermissions) {
    if (!toolPermissions || !allowedPermissions) return true;
    return toolPermissions.every((p) => allowedPermissions.includes(p));
  }

  resolveEnv(envConfig) {
    if (!envConfig) return {};
    const resolved = {};
    for (const [key, value] of Object.entries(envConfig)) {
      resolved[key] = value.replace(/\{\{user_config\}\}/g, '');
    }
    return resolved;
  }

  async disconnectServer(serverId) {
    const client = this.clients.get(serverId);
    if (client) {
      try { await client.close(); } catch {}
      this.clients.delete(serverId);
      this.serverConfigs.delete(serverId);
      for (const [name, info] of this.toolRegistry) {
        if (info.serverId === serverId) {
          this.toolRegistry.delete(name);
        }
      }
    }
  }

  async disconnectAll() {
    for (const [serverId] of this.clients) {
      await this.disconnectServer(serverId);
    }
  }

  getConnectedServers() {
    return Array.from(this.clients.keys());
  }

  isServerConnected(serverId) {
    return this.clients.has(serverId);
  }

  getConnectedServerIds() {
    return Array.from(this.clients.keys());
  }

  getRegisteredTools() {
    return Array.from(this.toolRegistry.entries()).map(([name, info]) => ({
      name,
      description: info.description,
      serverId: info.serverId,
      permissions: info.permissions,
    }));
  }
}

const mcpManager = new MCPManager();
export default mcpManager;
