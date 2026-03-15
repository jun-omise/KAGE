import mcpManager from '../../mcp/client.js';
import { checkPermission } from '../../mcp/permission-check.js';

export class ExecutorAgent {
  constructor(aiClient) {
    this.ai = aiClient;
    this.config = {
      role: 'executor',
      purpose: 'Executing plans created by the planner',
      systemPrompt: `You are KAGE's execution agent.
Execute subtasks received from the planner. Each subtask specifies which tools to use.

CRITICAL: When a subtask specifies tools (e.g. "tools": ["write_excel"]), you MUST call that exact tool immediately. Do NOT call other tools for exploration or verification first.

When calling a tool, respond with:
{
  "action": "tool_call",
  "tool": "<tool_name_from_subtask>",
  "arguments": { ... },
  "reasoning": "why this tool"
}

When no tool is needed, respond with:
{
  "action": "direct",
  "success": true,
  "result": "...",
  "details": {}
}

Tool argument formats:
- write_excel: { "filePath": "/absolute/path.xlsx", "sheets": [{ "name": "Sheet1", "headers": ["Col1","Col2"], "data": [["row1col1","row1col2"]] }] }
- create_presentation: { "filePath": "/absolute/path.pptx", "slides": [{ "layout": "title", "title": "...", "subtitle": "..." }] }
- open_application: { "appName": "App Name" }
- run_applescript: { "script": "tell application \\"AppName\\" to ..." } — Can control ANY macOS app (Adobe Illustrator, Photoshop, Final Cut, etc.)
- send_keys_to_app: { "appName": "App Name", "keys": "keystroke or shortcut" }
- File paths support ~ for home directory (e.g. ~/Desktop/file.xlsx)

Rules:
1. Use EXACTLY the tools listed in the subtask. Do NOT explore directories or check permissions first.
2. Provide complete arguments - do not omit required fields.
3. If an error occurs, retry with corrected arguments.
4. Never log sensitive data.
5. NEVER suggest installing plugins or MCP servers. Use run_applescript to control any app.`
    };
  }

  async execute(subtask, previousResults = [], { model } = {}) {
    const maxRetries = 3;
    let totalUsage = null;
    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Build context for AI — include error feedback from previous attempts
        const context = {
          task: 'execute_subtask',
          subtask,
          previous_results: previousResults,
          available_tools: mcpManager.getRegisteredTools().map(t => ({
            name: t.name,
            description: t.description,
          })),
          attempt: attempt + 1,
        };

        // If previous attempt failed, include error details so AI can correct
        if (lastError) {
          context.previous_error = lastError;
          context.instruction = `Previous attempt failed with error: "${lastError}". Please fix the arguments and try again. Common fixes: use camelCase (filePath not file_path), ensure arrays are properly formatted, use absolute paths.`;
        }

        // Ask the AI what to do with this subtask
        const { result: decision, usage } = await this.ai.runAgent(this.config, context, { model });

        // Accumulate usage across retries
        totalUsage = this._mergeUsage(totalUsage, usage);

        // If AI decides to call a tool
        if (decision.action === 'tool_call' && decision.tool) {
          const toolResult = await this._executeToolCall(subtask, decision);
          toolResult.usage = totalUsage;

          // If tool execution failed and we have retries left, feed error back to AI
          if (!toolResult.success && attempt < maxRetries - 1) {
            lastError = toolResult.error || 'Tool execution failed';
            console.error(`[Executor] Tool "${decision.tool}" failed (attempt ${attempt + 1}/${maxRetries}): ${lastError}`);
            continue; // Retry with error feedback
          }

          return toolResult;
        }

        // Direct answer (no tool needed)
        return {
          subtaskId: subtask.id,
          success: decision.success !== false,
          result: decision.result || decision.raw || 'Completed',
          details: decision.details || {},
          toolUsed: null,
          error: decision.error || null,
          usage: totalUsage,
        };

      } catch (error) {
        lastError = error.message;
        console.error(`[Executor] Attempt ${attempt + 1}/${maxRetries} error: ${error.message}`);
        if (attempt === maxRetries - 1) {
          return {
            subtaskId: subtask.id,
            success: false,
            result: null,
            details: { attempts: maxRetries, lastError },
            toolUsed: null,
            error: `Failed after ${maxRetries} attempts: ${error.message}`,
            usage: totalUsage,
          };
        }
        // Continue to next retry with error feedback
      }
    }
  }

  _mergeUsage(existing, newUsage) {
    if (!newUsage) return existing;
    if (!existing) return newUsage;
    return {
      input_tokens: (existing.input_tokens || 0) + (newUsage.input_tokens || 0),
      output_tokens: (existing.output_tokens || 0) + (newUsage.output_tokens || 0),
    };
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
