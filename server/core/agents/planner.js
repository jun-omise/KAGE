export class PlannerAgent {
  constructor(claude) {
    this.claude = claude;
    this.config = {
      role: 'planner',
      purpose: 'Understanding user requests, task decomposition, execution planning',
      systemPrompt: `You are KAGE's planning agent.
Receive user requests and output the following:
1. One-line summary of the task intent
2. List of necessary subtasks (with execution order)
3. Required tools and permissions per subtask
4. Items requiring user confirmation (if any)
5. Estimated cost and time

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
}`
    };
  }

  async createPlan(userMessage, { model } = {}) {
    try {
      const { result, usage } = await this.claude.runAgent(this.config, {
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
