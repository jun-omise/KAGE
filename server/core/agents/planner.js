export class PlannerAgent {
  constructor(claude) {
    this.claude = claude;
    this.baseSystemPrompt = `You are KAGE's planning agent.
Receive user requests and output the following:
1. One-line summary of the task intent
2. List of necessary subtasks (with execution order)
3. Required tools and permissions per subtask
4. Items requiring user confirmation (if any)
5. Estimated cost and time

IMPORTANT: You MUST use the available MCP tools listed below when they match the task. Do NOT suggest alternative approaches (Python scripts, manual steps, etc.) when a matching tool exists.
For file paths, always use absolute paths (e.g. /Users/username/Desktop/file.xlsx). The tilde (~) prefix is supported for home directory paths.

Output in JSON format:
{
  "summary": "...",
  "subtasks": [
    {
      "id": 1,
      "description": "...",
      "tools": [],
      "permissions": [],
      "estimated_cost": "$0.01",
      "requires_approval": false
    }
  ],
  "questions_for_user": [],
  "total_estimated_cost": "$0.03",
  "estimated_time": "30 seconds"
}

If the request is a simple question/conversation that doesn't need tools, return:
{
  "summary": "Simple conversation",
  "subtasks": [{"id": 1, "description": "Direct response", "tools": [], "permissions": [], "estimated_cost": "$0.01", "requires_approval": false}],
  "questions_for_user": [],
  "total_estimated_cost": "$0.01",
  "estimated_time": "5 seconds"
}`;
  }

  _buildConfig(availableTools) {
    let systemPrompt = this.baseSystemPrompt;
    if (availableTools && availableTools.length > 0) {
      const toolList = availableTools.map(t => `- ${t.name}: ${t.description}`).join('\n');
      systemPrompt += `\n\nAvailable MCP Tools:\n${toolList}`;
    }
    return {
      role: 'planner',
      purpose: 'Understanding user requests, task decomposition, execution planning',
      systemPrompt,
    };
  }

  async createPlan(userMessage, { model, availableTools } = {}) {
    try {
      const config = this._buildConfig(availableTools);
      const { result, usage } = await this.claude.runAgent(config, {
        task: 'create_plan',
        input: userMessage,
      }, { model });
      return {
        summary: result.summary || 'Processing request',
        subtasks: result.subtasks || [{ id: 1, description: userMessage, tools: [], permissions: [], estimated_cost: '$0.01', requires_approval: false }],
        questions_for_user: result.questions_for_user || [],
        total_estimated_cost: result.total_estimated_cost || '$0.01',
        estimated_time: result.estimated_time || '10 seconds',
        usage,
      };
    } catch {
      return {
        summary: 'Processing request',
        subtasks: [{ id: 1, description: userMessage, tools: [], permissions: [], estimated_cost: '$0.01', requires_approval: false }],
        questions_for_user: [],
        total_estimated_cost: '$0.01',
        estimated_time: '10 seconds',
        usage: null,
      };
    }
  }
}
