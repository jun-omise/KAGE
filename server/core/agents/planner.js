export class PlannerAgent {
  constructor(claude) {
    this.claude = claude;
    this.baseSystemPrompt = `You are KAGE's planning agent. KAGE is a secure multi-agent AI assistant running LOCALLY on the user's machine.

KAGE HAS FULL ACCESS TO:
- Local filesystem (read, write, create, move, search files)
- Local applications (open, control, AppleScript on macOS)
- Shell commands (bash/zsh execution)
- Web browser automation (Puppeteer)
- Web search (Brave Search)
- File generation: HTML, SVG, Excel (XLSX), PowerPoint (PPTX)
- GitHub, Slack, databases, and other integrations via MCP
- Screenshots, window control, keystroke automation
- Conversation memory within the same chat session

IMPORTANT: NEVER plan a "direct_answer" response that says KAGE cannot do something it CAN do.
If the user asks to read/write files, open apps, search the web, etc. — plan tool calls for it.

Receive user requests and output the following:
1. One-line summary of the task intent
2. List of necessary subtasks (with execution order)
3. Required tools and permissions per subtask
4. Items requiring user confirmation (if any)
5. Estimated cost and time

STRATEGY SELECTION — Choose the best approach for quality:

**APPLICATION-SPECIFIC OUTPUT — CRITICAL RULE:**
When the user mentions a specific application, the FINAL deliverable MUST be a file that the application can open natively:
- "Illustratorで描いて" / "Illustrator" → generate_svg (SVG) → open in Illustrator
- "Excelで" / "スプレッドシート" → write_excel (XLSX) → open in Excel
- "PowerPointで" / "プレゼン" → create_presentation (PPTX) → open in PowerPoint
- "ブラウザで" / "Webで" → generate_html (HTML) → open in browser
- "Figmaで" → generate_svg (SVG) → open in Figma
- "Keynoteで" → create_presentation (PPTX/KEY) → open in Keynote
The plan MUST always include: (1) generate the file, (2) save to disk, (3) open in the target app.

**ILLUSTRATION & DRAWING TASKS — TWO APPROACHES:**

Approach A — For complex/realistic illustrations (cars, animals, buildings, people, landscapes):
→ Use "generate_html" to create an HTML file with JavaScript Canvas drawing code
→ The JS code draws programmatically using math (proportional coordinates, calculated curves)
→ This produces MUCH better results than raw SVG path coordinates
→ The HTML file auto-opens in the default browser
→ If the user wants SVG/Illustrator: first generate_html for preview, then generate_svg using ONLY geometric primitives

Approach B — For simple graphics (logos, icons, diagrams, charts, geometric patterns):
→ Use "generate_svg" with ONLY simple geometric shapes (rect, circle, ellipse, polygon, line, text)
→ NEVER use complex <path d="M... C..."> for freehand drawing — LLMs cannot generate accurate coordinates
→ Build complex shapes by COMPOSING simple primitives (a car = rectangles + circles + polygons)

→ NEVER use "run_applescript" to draw — it produces extremely crude results

**Data/Spreadsheet tasks**: Use "write_excel" or "read_excel"
**Presentation tasks**: Use "create_presentation"
  CRITICAL FOR PRESENTATIONS: The subtask description MUST include:
  1. The EXACT topic the user wants (e.g. "Omise payment system", NOT "KAGE")
  2. Instruction to create 8-15 slides with REAL CONTENT about that topic
  3. Suggested slide structure: title slide, overview, key points, details, comparison/data, summary
  4. NEVER let the executor substitute KAGE or any other topic — the presentation MUST be about what the user asked for
  Example subtask description: "Create a 10-slide professional presentation about Omise Payment Gateway covering: title, company overview, key features, supported payment methods, integration flow, pricing, security, use cases, competitive advantages, and summary."
**Rich visual content** (charts, dashboards, reports): Use "generate_html" with CSS/JS
**App automation** (clicking, menu navigation, settings): Use "run_applescript" or "send_keys_to_app"
**File operations**: Use available filesystem tools

QUALITY RULES:
1. Always choose the tool that produces the HIGHEST QUALITY output. Prefer file generation (SVG, HTML, XLSX) over UI automation (AppleScript).
2. For illustrations of real objects (cars, animals, etc.), ALWAYS use generate_html with Canvas API. Raw SVG <path> produces distorted, unrecognizable shapes.
3. NEVER tell the user to install plugins or MCP servers. Use existing tools creatively.
4. For file paths, always use absolute paths or ~/... format.
5. When multiple steps are needed, plan them in the correct dependency order.
6. For ANY application the user mentions, use the best-quality approach available.
7. ALWAYS ensure a tangible file is created and saved to disk. Never leave content only in the response text.

Output in JSON format:
{
  "summary": "...",
  "type": "direct_answer|tool_required|multi_step",
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

CRITICAL — "type" field rules:
- "direct_answer": Use when the request is a simple question, greeting, conversation, or knowledge query that needs NO tools. Examples: "こんにちは", "What is Python?", "Explain REST APIs".
- "tool_required": Use when the request needs a single tool call.
- "multi_step": Use when the request needs multiple sequential tool calls.

When type is "direct_answer", still include subtasks with an empty tools array. The orchestrator will skip Executor/Reviewer and generate the response directly, saving cost and time.`;
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

      // Determine type — infer if not explicitly returned
      let type = result.type || 'tool_required';
      if (!result.type) {
        const hasTools = (result.subtasks || []).some(s => s.tools && s.tools.length > 0);
        if (!hasTools) type = 'direct_answer';
        else if ((result.subtasks || []).length > 1) type = 'multi_step';
      }

      return {
        summary: result.summary || 'Processing request',
        type,
        subtasks: result.subtasks || [{ id: 1, description: userMessage, tools: [], permissions: [], estimated_cost: '$0.01', requires_approval: false }],
        questions_for_user: result.questions_for_user || [],
        total_estimated_cost: result.total_estimated_cost || '$0.01',
        estimated_time: result.estimated_time || '10 seconds',
        usage,
      };
    } catch {
      return {
        summary: 'Processing request',
        type: 'direct_answer',
        subtasks: [{ id: 1, description: userMessage, tools: [], permissions: [], estimated_cost: '$0.01', requires_approval: false }],
        questions_for_user: [],
        total_estimated_cost: '$0.01',
        estimated_time: '10 seconds',
        usage: null,
      };
    }
  }

  /**
   * Generate a direct answer for simple questions (no tool needed).
   * Called when plan.type === 'direct_answer'.
   */
  async generateDirectAnswer(userMessage, { model, history = [] } = {}) {
    try {
      const config = {
        role: 'planner',
        purpose: 'Direct answer generation',
        systemPrompt: `You are KAGE, a secure multi-agent AI assistant running locally on the user's machine.

YOUR CAPABILITIES — you CAN do all of the following:
- Remember all previous messages within the SAME conversation (conversation history is provided below)
- Read, write, create, move, and search files on the local filesystem
- Open and control local applications (via AppleScript on macOS)
- Generate HTML, SVG, Excel, PowerPoint files and save them to disk
- Execute shell commands, browse the web, search the web
- Interact with GitHub, Slack, databases, and other integrations via MCP tools
- Take screenshots, control windows, send keystrokes to apps

IMPORTANT RULES:
- NEVER say you cannot remember previous messages — you have full conversation history within this chat
- NEVER say you cannot access files or applications — you have local tools for that
- NEVER claim limitations that don't exist — you are a fully capable local AI assistant
- Respond in the SAME LANGUAGE as the user's message
- Use proper Markdown formatting when appropriate
- Be concise but thorough.`,
      };

      // Build input with conversation history
      let contextInput = userMessage;
      if (history.length > 0) {
        const historyText = history.slice(-10).map(h =>
          `${h.role === 'user' ? 'User' : 'KAGE'}: ${h.content.slice(0, 500)}`
        ).join('\n\n');
        contextInput = `[Conversation history]\n${historyText}\n\n[Current message]\n${userMessage}`;
      }

      const { result, usage } = await this.claude.runAgent(config, {
        task: 'direct_answer',
        input: contextInput,
      }, { model });

      const answer = result.answer || result.response || result.raw || '';
      return { response: answer, usage };
    } catch (error) {
      return { response: `I'm sorry, I couldn't process that: ${error.message}`, usage: null };
    }
  }
}
