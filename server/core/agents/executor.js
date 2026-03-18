import mcpManager from '../../mcp/client.js';
import { checkPermission } from '../../mcp/permission-check.js';
import { analyzeCommand } from '../../security/shell-policy.js';

export class ExecutorAgent {
  constructor(aiClient) {
    this.ai = aiClient;
    this.config = {
      role: 'executor',
      purpose: 'Executing plans created by the planner',
      systemPrompt: `You are KAGE's execution agent. You produce HIGH-QUALITY output.

Execute subtasks received from the planner. Each subtask specifies which tools to use.

ABSOLUTE RULE: When a subtask specifies tools (e.g. "tools": ["generate_svg"]), you MUST respond with action:"tool_call" using that tool. NEVER respond with action:"direct" when tools are specified. NEVER skip the tool call even if you could generate the content directly — the tool call is what saves the file to disk.

Response format for tool calls:
{
  "action": "tool_call",
  "tool": "<tool_name>",
  "arguments": { ... },
  "reasoning": "why this tool"
}

Response format when no tool is needed:
{
  "action": "direct",
  "success": true,
  "result": "...",
  "details": {}
}

═══════════════════════════════════════
ILLUSTRATION / DRAWING via generate_html (Canvas API)
═══════════════════════════════════════
For ANY illustration of real objects (cars, animals, buildings, people, landscapes, products),
use generate_html with JavaScript Canvas to draw PROGRAMMATICALLY.

CRITICAL TECHNIQUE — Use mathematical/proportional drawing:
- Define the object's bounding box and anchor points as variables
- Calculate all coordinates relative to those anchors using ratios
- Use helper functions for repeated shapes (drawWheel, drawWindow, etc.)
- Use Canvas API: ctx.beginPath(), ctx.moveTo(), ctx.bezierCurveTo(), ctx.quadraticCurveTo()
- Apply gradients: ctx.createLinearGradient(), ctx.createRadialGradient()
- Add shadows: ctx.shadowColor, ctx.shadowBlur, ctx.shadowOffsetX/Y

Example structure for a car illustration:
\`\`\`javascript
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

// Define proportional anchor points
const ground = H * 0.75;
const carLeft = W * 0.1, carRight = W * 0.9;
const carWidth = carRight - carLeft;
const bodyTop = ground - carWidth * 0.22;
const roofTop = ground - carWidth * 0.38;

// Helper: draw a wheel at (cx, cy) with radius r
function drawWheel(cx, cy, r) {
  // Tire
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.fillStyle = '#1a1a1a'; ctx.fill();
  // Rim
  ctx.beginPath(); ctx.arc(cx, cy, r*0.7, 0, Math.PI*2);
  const rimGrad = ctx.createRadialGradient(cx-r*0.2, cy-r*0.2, 0, cx, cy, r*0.7);
  rimGrad.addColorStop(0, '#d0d0d0'); rimGrad.addColorStop(1, '#808080');
  ctx.fillStyle = rimGrad; ctx.fill();
  // Spokes
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * r * 0.65, cy + Math.sin(angle) * r * 0.65);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 3; ctx.stroke();
  }
}
// ... then draw body, windows, details using proportional math
\`\`\`

MANDATORY QUALITY CHECKLIST for Canvas illustrations:
□ Canvas size at least 1200x800 for detail
□ All coordinates defined as proportions/variables, NEVER hardcoded magic numbers
□ Gradient fills for body paint, metallic surfaces, glass
□ Shadow effects for depth (ctx.shadowBlur)
□ At least 3 layers: background → main shape → details/highlights
□ Helper functions for repeated elements
□ Anti-aliased curves using bezierCurveTo/quadraticCurveTo
□ Reflections/highlights on glass and chrome surfaces

═══════════════════════════════════════
SVG via generate_svg (GEOMETRIC PRIMITIVES ONLY)
═══════════════════════════════════════
For simple graphics (logos, icons, diagrams, charts):
- Use ONLY: <rect>, <circle>, <ellipse>, <polygon>, <polyline>, <line>, <text>
- Compose complex shapes from simple primitives
- NEVER use complex <path d="M... C..."> for freehand organic shapes — LLMs cannot generate accurate coordinates
- Simple <path> for straight lines (M, L, Z only) is OK
- Use <linearGradient>, <radialGradient> for depth
- Use <filter> for shadows

generate_svg args: { "filePath": "~/Desktop/output.svg", "svgContent": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'>...</svg>", "openInApp": "Adobe Illustrator" }

═══════════════════════════════════════
OTHER TOOLS
═══════════════════════════════════════
- generate_html: { "filePath": "~/Desktop/output.html", "htmlContent": "<!DOCTYPE html>...", "openInBrowser": true }
- write_excel: { "filePath": "/absolute/path.xlsx", "sheets": [{ "name": "Sheet1", "headers": ["Col1","Col2"], "data": [["val1","val2"]] }] }
- create_presentation: Create PROFESSIONAL multi-slide presentations about the USER'S TOPIC (NOT about KAGE).
  CRITICAL: You MUST generate 8-15 slides with REAL, DETAILED content based on the user's request.
  NEVER create only a title slide. NEVER substitute KAGE content for the user's topic.
  Example structure:
  { "filePath": "~/Desktop/presentation.pptx",
    "title": "User's Topic Title",
    "slides": [
      { "layout": "title", "title": "Main Title", "subtitle": "Subtitle or tagline" },
      { "layout": "content", "title": "Overview", "bullets": ["Point 1 with detail", "Point 2 with detail", "Point 3 with detail"] },
      { "layout": "content", "title": "Key Features", "bullets": ["Feature A — explanation", "Feature B — explanation"] },
      { "layout": "two_column", "title": "Comparison", "leftColumn": "Left content...", "rightColumn": "Right content..." },
      { "layout": "content", "title": "Details", "body": "Paragraph text explaining the topic in depth..." },
      { "layout": "content", "title": "Data Overview", "table": { "headers": ["Col1","Col2","Col3"], "rows": [["a","b","c"],["d","e","f"]] } },
      { "layout": "content", "title": "Summary", "bullets": ["Takeaway 1", "Takeaway 2", "Takeaway 3"] }
    ],
    "theme": { "primaryColor": "4F46E5", "secondaryColor": "7C3AED" }
  }
  Available layouts: "title", "content", "two_column", "image", "blank"
  Each slide can have: title, subtitle, body, bullets[], table{headers,rows}, leftColumn, rightColumn, imagePath, notes
- open_application: { "appName": "App Name" }
- run_applescript: { "script": "tell application \\"AppName\\" to ..." }
- send_keys_to_app: { "appName": "App Name", "keys": "keystroke or shortcut" }
- File paths support ~ for home directory

QUALITY RULES:
1. ALWAYS produce professional, detailed, high-quality output. Never cut corners.
2. For illustrations: use generate_html + Canvas with PROPORTIONAL MATH drawing.
3. For data tasks: include proper formatting, headers, calculated fields.
4. Provide complete arguments — never omit required fields.
5. If an error occurs, analyze the error carefully and retry with corrected arguments.
6. NEVER suggest installing plugins or MCP servers.
7. CRITICAL: When creating content (presentations, documents, etc.), the content MUST be about the USER'S TOPIC specified in "userRequest" — NEVER about KAGE itself unless explicitly asked. If subtask has a "userRequest" field, that is the user's original message and your content MUST match it.`
    };
  }

  async execute(subtask, previousResults = [], { model, qualityResearch, skillInstructions } = {}) {
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

        // Include quality research context if available
        if (qualityResearch && qualityResearch.quality_criteria?.length > 0) {
          context.quality_requirements = {
            criteria: qualityResearch.quality_criteria,
            technical_specs: qualityResearch.technical_specs,
            reference_description: qualityResearch.reference_description,
            common_mistakes_to_avoid: qualityResearch.common_mistakes,
            approach: qualityResearch.approach_recommendation,
          };
        }

        // Include skill instructions if available
        if (skillInstructions) {
          context.skill_instructions = skillInstructions;
        }

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

        // CODE-LEVEL ENFORCEMENT: If AI returned "direct" but subtask specifies tools,
        // attempt to extract content and auto-call the tool programmatically.
        // This fixes the common issue where the AI generates SVG/HTML content inline
        // instead of wrapping it in a tool_call.
        if (decision.action !== 'tool_call' && subtask.tools && subtask.tools.length > 0) {
          console.log(`[Executor] AI returned action="${decision.action}" but subtask requires tools: [${subtask.tools.join(', ')}]`);
          console.log(`[Executor] Decision keys: ${Object.keys(decision).join(', ')}`);
          console.log(`[Executor] Result preview: ${(decision.result || decision.raw || '').toString().slice(0, 200)}`);
          const rescued = this._rescueDirectResponse(subtask, decision);
          if (rescued) {
            console.log(`[Executor] Rescued direct response → auto-calling tool "${rescued.tool}"`);
            const toolResult = await this._executeToolCall(subtask, rescued);
            toolResult.usage = totalUsage;
            if (!toolResult.success && attempt < maxRetries - 1) {
              lastError = toolResult.error || 'Tool execution failed (rescued)';
              console.error(`[Executor] Rescued tool "${rescued.tool}" failed (attempt ${attempt + 1}/${maxRetries}): ${lastError}`);
              continue;
            }
            return toolResult;
          }
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

  /**
   * Rescue a "direct" response when the AI should have called a tool.
   * Extracts SVG/HTML content from the response text and constructs
   * a synthetic tool_call decision so the file gets saved to disk.
   */
  _rescueDirectResponse(subtask, decision) {
    // Collect ALL text from the decision object — the SVG/HTML might be in any field
    const allTexts = [];
    for (const [key, val] of Object.entries(decision)) {
      if (typeof val === 'string') allTexts.push(val);
      else if (typeof val === 'object' && val) {
        try { allTexts.push(JSON.stringify(val)); } catch {}
      }
    }
    const responseText = allTexts.join('\n');
    const tools = subtask.tools || [];
    console.log(`[Executor Rescue] Searching ${responseText.length} chars for content matching tools: [${tools.join(', ')}]`);

    // Try to rescue generate_svg
    if (tools.includes('generate_svg')) {
      const svgMatch = responseText.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) {
        // Derive a file path from subtask description
        const filePath = this._deriveFilePath(subtask.description, 'svg');
        return {
          action: 'tool_call',
          tool: 'generate_svg',
          arguments: {
            filePath,
            svgContent: svgMatch[0],
            openInApp: this._detectTargetApp(subtask.description, 'svg'),
          },
          reasoning: 'Auto-rescued: AI returned SVG content as direct response instead of tool_call',
        };
      }
    }

    // Try to rescue generate_html
    if (tools.includes('generate_html')) {
      const htmlMatch = responseText.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i)
        || responseText.match(/<html[\s\S]*?<\/html>/i);
      if (htmlMatch) {
        const filePath = this._deriveFilePath(subtask.description, 'html');
        return {
          action: 'tool_call',
          tool: 'generate_html',
          arguments: {
            filePath,
            htmlContent: htmlMatch[0],
            openInBrowser: true,
          },
          reasoning: 'Auto-rescued: AI returned HTML content as direct response instead of tool_call',
        };
      }
    }

    // Try to rescue write_excel — look for JSON data that could be sheet data
    if (tools.includes('write_excel')) {
      try {
        const sheetsMatch = responseText.match(/"sheets"\s*:\s*\[[\s\S]*?\]\s*\]/);
        if (sheetsMatch) {
          const parsed = JSON.parse(`{${sheetsMatch[0]}}`);
          if (parsed.sheets) {
            const filePath = this._deriveFilePath(subtask.description, 'xlsx');
            return {
              action: 'tool_call',
              tool: 'write_excel',
              arguments: { filePath, sheets: parsed.sheets },
              reasoning: 'Auto-rescued: AI returned Excel data as direct response',
            };
          }
        }
      } catch {}
    }

    // Try to rescue create_presentation — look for slides JSON data
    if (tools.includes('create_presentation')) {
      try {
        // Try to parse the entire decision as potential presentation data
        const slidesData = this._extractPresentationData(decision, responseText, subtask);
        if (slidesData) {
          console.log(`[Executor Rescue] Found presentation data with ${slidesData.slides.length} slides`);
          return {
            action: 'tool_call',
            tool: 'create_presentation',
            arguments: slidesData,
            reasoning: 'Auto-rescued: AI returned presentation data as direct response instead of tool_call',
          };
        }
      } catch (e) {
        console.error(`[Executor Rescue] create_presentation rescue failed: ${e.message}`);
      }
    }

    return null; // Could not rescue
  }

  /**
   * Derive an output file path from the subtask description.
   */
  _deriveFilePath(description, ext) {
    // Extract meaningful words for filename
    const words = description
      .replace(/[^\w\s\u3000-\u9FFF\uF900-\uFAFF]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1)
      .slice(0, 3)
      .join('_')
      .toLowerCase();
    const name = words || 'output';
    return `~/Desktop/${name}.${ext}`;
  }

  /**
   * Detect target application from subtask description.
   */
  _detectTargetApp(description, type) {
    const desc = description.toLowerCase();
    if (type === 'svg') {
      if (desc.includes('illustrator')) return 'Adobe Illustrator';
      if (desc.includes('inkscape')) return 'Inkscape';
      if (desc.includes('figma')) return 'Figma';
    }
    return null;
  }

  /**
   * Extract presentation data from a direct AI response.
   * Looks for slides array in various locations within the decision object.
   */
  _extractPresentationData(decision, responseText, subtask) {
    // Strategy 1: Check if decision has arguments/details with slides already structured
    const candidates = [
      decision.arguments,
      decision.details,
      decision.result && typeof decision.result === 'object' ? decision.result : null,
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (candidate.slides && Array.isArray(candidate.slides) && candidate.slides.length > 0) {
        return {
          filePath: candidate.filePath || this._deriveFilePath(subtask.description, 'pptx'),
          title: candidate.title || this._derivePresentationTitle(subtask.description),
          author: candidate.author || undefined,
          slides: candidate.slides,
          theme: candidate.theme || undefined,
        };
      }
    }

    // Strategy 2: Extract slides JSON from response text
    const slidesMatch = responseText.match(/"slides"\s*:\s*\[[\s\S]*?\]\s*(?=\s*[,}])/);
    if (slidesMatch) {
      try {
        // Wrap in braces and try to parse
        let jsonStr = `{${slidesMatch[0]}}`;
        const parsed = JSON.parse(jsonStr);
        if (parsed.slides && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          // Also try to extract filePath and title
          const titleMatch = responseText.match(/"title"\s*:\s*"([^"]+)"/);
          const filePathMatch = responseText.match(/"filePath"\s*:\s*"([^"]+)"/);
          return {
            filePath: filePathMatch ? filePathMatch[1] : this._deriveFilePath(subtask.description, 'pptx'),
            title: titleMatch ? titleMatch[1] : this._derivePresentationTitle(subtask.description),
            slides: parsed.slides,
          };
        }
      } catch {}
    }

    // Strategy 3: Try parsing the entire response as JSON
    try {
      const fullParsed = JSON.parse(responseText);
      if (fullParsed.slides && Array.isArray(fullParsed.slides)) {
        return {
          filePath: fullParsed.filePath || this._deriveFilePath(subtask.description, 'pptx'),
          title: fullParsed.title || this._derivePresentationTitle(subtask.description),
          slides: fullParsed.slides,
          theme: fullParsed.theme || undefined,
        };
      }
    } catch {}

    return null;
  }

  /**
   * Derive a presentation title from subtask description.
   */
  _derivePresentationTitle(description) {
    // Remove common instruction words and extract the topic
    return description
      .replace(/create|make|build|generate|a|the|presentation|for|about|pptx|powerpoint/gi, '')
      .trim()
      .replace(/\s+/g, ' ')
      || 'Presentation';
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

    // Shell command safety check
    if (['run_command', 'execute_command'].includes(toolName)) {
      const cmd = toolArgs.command || toolArgs.cmd || '';
      const shellCheck = analyzeCommand(cmd);

      if (shellCheck.blocked) {
        return {
          subtaskId: subtask.id,
          success: false,
          result: null,
          details: { reason: shellCheck.reason, riskLevel: shellCheck.riskLevel },
          toolUsed: toolName,
          error: `Shell command blocked: ${shellCheck.reason}`,
        };
      }

      if (shellCheck.requiresApproval) {
        console.warn(`[Executor] Shell command requires approval: "${cmd}" (risk: ${shellCheck.riskLevel})`);
        return {
          subtaskId: subtask.id,
          success: false,
          result: null,
          details: {
            reason: shellCheck.reason,
            riskLevel: shellCheck.riskLevel,
            command: cmd,
            requiresApproval: true,
          },
          toolUsed: toolName,
          error: `Shell command requires approval: "${cmd}" — ${shellCheck.reason}`,
        };
      }
    }

    // Normalize arguments for common MCP tools (AI often uses camelCase, MCP expects snake_case)
    const normalizedArgs = this._normalizeToolArgs(toolName, toolArgs);

    // Execute the tool via MCP
    try {
      const toolResult = await mcpManager.callTool(toolName, normalizedArgs);

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

  /**
   * Normalize tool arguments to match MCP server expectations.
   * AI models often use camelCase (filePath) while MCP servers expect snake_case (path).
   * Also resolves macOS /tmp → /private/tmp symlink issue.
   */
  _normalizeToolArgs(toolName, args) {
    const normalized = { ...args };

    // Filesystem tools: normalize filePath → path
    if (['write_file', 'read_file', 'read_text_file', 'get_file_info', 'edit_file'].includes(toolName)) {
      if (normalized.filePath && !normalized.path) {
        normalized.path = normalized.filePath;
        delete normalized.filePath;
      }
      if (normalized.file_path && !normalized.path) {
        normalized.path = normalized.file_path;
        delete normalized.file_path;
      }
      // macOS: resolve /tmp → /private/tmp
      if (normalized.path && normalized.path.startsWith('/tmp/')) {
        normalized.path = '/private' + normalized.path;
      }
    }

    // list_directory: normalize directoryPath → path
    if (['list_directory', 'list_directory_with_sizes', 'directory_tree', 'create_directory'].includes(toolName)) {
      if (normalized.directoryPath && !normalized.path) {
        normalized.path = normalized.directoryPath;
        delete normalized.directoryPath;
      }
      if (normalized.directory_path && !normalized.path) {
        normalized.path = normalized.directory_path;
        delete normalized.directory_path;
      }
    }

    // move_file: normalize source/destination
    if (toolName === 'move_file') {
      if (normalized.sourcePath && !normalized.source) {
        normalized.source = normalized.sourcePath;
        delete normalized.sourcePath;
      }
      if (normalized.destinationPath && !normalized.destination) {
        normalized.destination = normalized.destinationPath;
        delete normalized.destinationPath;
      }
    }

    // search_files: normalize searchPath → path, searchPattern → pattern
    if (toolName === 'search_files') {
      if (normalized.searchPath && !normalized.path) {
        normalized.path = normalized.searchPath;
        delete normalized.searchPath;
      }
      if (normalized.searchPattern && !normalized.pattern) {
        normalized.pattern = normalized.searchPattern;
        delete normalized.searchPattern;
      }
    }

    // Expand ~ in paths
    for (const key of ['path', 'source', 'destination']) {
      if (normalized[key] && normalized[key].startsWith('~/')) {
        normalized[key] = normalized[key].replace('~', process.env.HOME || '/Users/jun');
      }
    }

    return normalized;
  }
}
