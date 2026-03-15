import mcpManager from '../../mcp/client.js';
import { checkPermission } from '../../mcp/permission-check.js';

export class ExecutorAgent {
  constructor(aiClient) {
    this.ai = aiClient;
    this.config = {
      role: 'executor',
      purpose: 'Executing plans created by the planner',
      systemPrompt: `You are KAGE's execution agent.
Execute subtasks received from the planner one by one.

When a subtask requires tool usage, analyze which MCP tool to call and respond with:
{
  "action": "tool_call",
  "tool": "<tool_name>",
  "arguments": { ... },
  "reasoning": "why this tool"
}

When a subtask can be answered directly (no tool needed), respond with:
{
  "action": "direct",
  "success": true,
  "result": "...",
  "details": {}
}

Important rules:
1. Only use tools specified by the planner or inferred from the subtask
2. Report results of each step in structured format
3. If an error occurs, retry up to 3 times then report failure
4. Never log sensitive data
5. Always check if the tool is available before calling it`
    };
  }

  async execute(subtask, previousResults = []) {
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Ask the AI what to do with this subtask
        const decision = await this.ai.runAgent(this.config, {
          task: 'execute_subtask',
          subtask,
          previous_results: previousResults,
          available_tools: mcpManager.getRegisteredTools().map(t => ({
            name: t.name,
            description: t.description,
          })),
          attempt: attempt + 1,
        });

        // If AI decides to call a tool
        if (decision.action === 'tool_call' && decision.tool) {
          return await this._executeToolCall(subtask, decision);
        }

        // Direct answer (no tool needed)
        return {
          subtaskId: subtask.id,
          success: decision.success !== false,
          result: decision.result || decision.raw || 'Completed',
          details: decision.details || {},
          toolUsed: null,
          error: decision.error || null,
        };

      } catch (error) {
        if (attempt === maxRetries - 1) {
          return {
            subtaskId: subtask.id,
            success: false,
            result: null,
            details: { attempts: maxRetries },
            toolUsed: null,
            error: error.message,
          };
        }
        // Retry
      }
    }
  }

  async _executeToolCall(subtask, decision) {
    const toolName = decision.tool;
    const toolArgs = decision.arguments || {};

    // Check if tool is available
    const registeredTools = mcpManager.getRegisteredTools();
    const tool = registeredTools.find(t => t.name === toolName);

    if (!tool) {
      return {
        subtaskId: subtask.id,
        success: false,
        result: null,
        details: { requestedTool: toolName, available: registeredTools.map(t => t.name) },
        toolUsed: toolName,
        error: `Tool "${toolName}" is not connected. Available tools: ${registeredTools.map(t => t.name).join(', ') || 'none'}`,
      };
    }

    // Check permissions
    const permCheck = checkPermission(toolName, tool.permissions);
    if (permCheck.denied) {
      return {
        subtaskId: subtask.id,
        success: false,
        result: null,
        details: { reason: permCheck.reason },
        toolUsed: toolName,
        error: `Permission denied for tool "${toolName}": ${permCheck.reason}`,
      };
    }

    // Execute the tool via MCP
    try {
      const toolResult = await mcpManager.callTool(toolName, toolArgs);

      // Extract text content from MCP result
      const resultText = toolResult.content
        ?.map(c => c.type === 'text' ? c.text : JSON.stringify(c))
        ?.join('\n') || JSON.stringify(toolResult);

      return {
        subtaskId: subtask.id,
        success: !toolResult.isError,
        result: resultText,
        details: {
          tool: toolName,
          arguments: toolArgs,
          reasoning: decision.reasoning,
        },
        toolUsed: toolName,
        error: toolResult.isError ? resultText : null,
      };
    } catch (error) {
      return {
        subtaskId: subtask.id,
        success: false,
        result: null,
        details: { tool: toolName, arguments: toolArgs },
        toolUsed: toolName,
        error: `Tool execution failed: ${error.message}`,
      };
    }
  }
}
