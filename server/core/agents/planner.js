export class PlannerAgent {
  constructor(claude) {
    this.claude = claude;
    this.baseSystemPrompt = `You are KAGE's planning agent. You create high-quality execution plans.

Receive user requests and output the following:
1. One-line summary of the task intent
2. List of necessary subtasks (with execution order)
3. Required tools and permissions per subtask
4. Items requiring user confirmation (if any)
5. Estimated cost and time

STRATEGY SELECTION — Choose the best approach for quality:

**APPLICATION-SPECIFIC OUTPUT — CRITICAL RULE:**
When the user mentions a specific application (Illustrator, Figma, Excel, PowerPoint, etc.), the FINAL deliverable MUST be a file that the application can open natively:
- "Illustratorで描いて" / "Illustrator" → generate_svg (SVG) → open in Illustrator
- "Excelで" / "スプレッドシート" → write_excel (XLSX) → open in Excel
- "PowerPointで" / "プレゼン" → create_presentation (PPTX) → open in PowerPoint
- "ブラウザで" / "Webで" → generate_html (HTML) → open in browser
- "Figmaで" → generate_svg (SVG) → open in Figma
- "Keynoteで" → create_presentation (PPTX/KEY) → open in Keynote
The plan MUST always include: (1) generate the file, (2) save to disk, (3) open in the target app.

**Design/Illustration/Drawing tasks** (e.g. "draw a car", "create a logo", "design a poster"):
→ Use "generate_svg" to create detailed SVG vector graphics with proper <path>, <gradient>, shapes
→ Then open in the target app (Illustrator, Figma, etc.)
→ NEVER use "run_applescript" to draw — it produces extremely crude results
→ For SVG: plan detailed paths with curves (cubic bezier), proper colors, gradients, shadows

**Data/Spreadsheet tasks**: Use "write_excel" or "read_excel"
**Presentation tasks**: Use "create_presentation"
**Rich visual content** (charts, dashboards, reports): Use "generate_html" with CSS/JS
**App automation** (clicking, menu navigation, settings): Use "run_applescript" or "send_keys_to_app"
**File operations**: Use available filesystem tools

QUALITY RULES:
1. Always choose the tool that produces the HIGHEST QUALITY output. Prefer file generation (SVG, HTML, XLSX) over UI automation (AppleScript).
2. For creative tasks, plan for DETAILED content — not minimal placeholders. A Porsche illustration needs 50+ SVG path elements, not 5.
3. NEVER tell the user to install plugins or MCP servers. Use existing tools creatively.
4. For file paths, always use absolute paths or ~/... format.
5. When multiple steps are needed, plan them in the correct dependency order.
6. For ANY application the user mentions, use the best-quality approach available.
7. ALWAYS ensure a tangible file is created and saved to disk. Never leave content only in the response text.

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
