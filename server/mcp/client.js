import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

class MCPManager {
  constructor() {
    this.clients = new Map();
    this.toolRegistry = new Map();
  }

  async connectServer(serverConfig) {
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
    return tools.tools;
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
      await client.close();
      this.clients.delete(serverId);
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
