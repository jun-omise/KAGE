/**
 * KAGE Research Agent
 * Searches the web for quality references and benchmarks before task execution.
 * Provides the executor with context about what "high quality" looks like for the specific task.
 */

import mcpManager from '../../mcp/client.js';
import autoResolver from '../../mcp/auto-resolver.js';

export class ResearchAgent {
  constructor(aiClient) {
    this.ai = aiClient;
    this.config = {
      role: 'researcher',
      purpose: 'Quality research — gathering references and benchmarks for high-quality output',
      systemPrompt: `You are KAGE's quality research agent. Your job is to analyze a task and provide quality guidance.

Given a task and its execution plan, you determine:
1. What "high quality" means for this specific task
2. Key quality criteria and benchmarks
3. Specific technical recommendations

For VISUAL/DESIGN tasks:
- Describe what professional-quality output looks like (proportions, colors, composition, detail level)
- List specific technical elements needed (e.g., for a car: correct wheel-to-body ratio ~1:4, low stance, proper wheelbase)
- Reference professional design principles

For DATA/DOCUMENT tasks:
- Describe professional formatting standards
- List expected sections, structure, completeness criteria
- Reference industry best practices

For AUTOMATION tasks:
- Describe expected behavior and edge cases
- List verification steps

Respond in JSON format:
{
  "task_type": "illustration|document|data|automation|general",
  "quality_criteria": ["criterion 1", "criterion 2", ...],
  "technical_specs": {
    "key1": "specific technical requirement",
    "key2": "..."
  },
  "reference_description": "Detailed description of what professional output looks like",
  "common_mistakes": ["mistake to avoid 1", "mistake to avoid 2"],
  "approach_recommendation": "Best approach/tool to use for maximum quality"
}`
    };
  }

  /**
   * Research quality standards for a task.
   * Optionally performs web search for references if search tools are available.
   */
  async research(userMessage, plan, { model, conversationId } = {}) {
    try {
      // Step 1: Try to gather web references if search is available
      let webContext = null;
      try {
        webContext = await this._searchForReferences(userMessage, plan, conversationId);
      } catch (e) {
        console.log('[Researcher] Web search not available or failed:', e.message);
      }

      // Step 2: Ask AI to analyze quality requirements
      const context = {
        task: 'quality_research',
        user_request: userMessage,
        plan_summary: plan.summary,
        subtasks: plan.subtasks?.map(s => ({
          description: s.description,
          tools: s.tools,
        })),
        web_references: webContext,
      };

      const { result, usage } = await this.ai.runAgent(this.config, context, { model });

      return {
        task_type: result.task_type || 'general',
        quality_criteria: result.quality_criteria || [],
        technical_specs: result.technical_specs || {},
        reference_description: result.reference_description || '',
        common_mistakes: result.common_mistakes || [],
        approach_recommendation: result.approach_recommendation || '',
        web_references: webContext,
        usage,
      };
    } catch (error) {
      console.error('[Researcher] Research failed:', error.message);
      return {
        task_type: 'general',
        quality_criteria: [],
        technical_specs: {},
        reference_description: '',
        common_mistakes: [],
        approach_recommendation: '',
        web_references: null,
        usage: null,
      };
    }
  }

  /**
   * Search the web for quality references related to the task.
   */
  async _searchForReferences(userMessage, plan, conversationId) {
    // Check if any search tool is available
    const registeredTools = mcpManager.getRegisteredTools();
    const searchTools = registeredTools.filter(t =>
      ['brave_web_search', 'brave_search', 'tavily_search', 'web_search'].includes(t.name)
    );

    // If no search tool available, try auto-connecting
    if (searchTools.length === 0) {
      // First try local_apps which has web_search built-in (no API key needed)
      try {
        const connected = await autoResolver.autoConnect('local_apps', conversationId);
        if (connected.success) {
          const updatedTools = mcpManager.getRegisteredTools();
          searchTools.push(...updatedTools.filter(t => t.name === 'web_search'));
        }
      } catch {}
    }

    // Try brave_search if available (better quality but needs API key)
    if (searchTools.length === 0) {
      try {
        const connected = await autoResolver.autoConnect('brave_search', conversationId);
        if (connected.success) {
          const updatedTools = mcpManager.getRegisteredTools();
          searchTools.push(...updatedTools.filter(t => t.name.includes('brave') || t.name.includes('search')));
        }
      } catch {}
    }

    if (searchTools.length === 0) {
      return null; // No search capability available
    }

    // Build search query based on task
    const searchQuery = this._buildSearchQuery(userMessage, plan);
    if (!searchQuery) return null;

    try {
      const searchTool = searchTools[0];
      const searchArgs = searchTool.name.includes('brave')
        ? { query: searchQuery, count: 5 }
        : { query: searchQuery };

      const result = await mcpManager.callTool(searchTool.name, searchArgs);
      const text = result.content
        ?.map(c => c.type === 'text' ? c.text : '')
        ?.join('\n') || '';

      return {
        query: searchQuery,
        results: text.slice(0, 3000), // Limit context size
        source: searchTool.name,
      };
    } catch (error) {
      console.log('[Researcher] Search failed:', error.message);
      return null;
    }
  }

  /**
   * Build an optimal search query for quality references.
   */
  _buildSearchQuery(userMessage, plan) {
    const taskType = this._detectTaskType(userMessage, plan);

    switch (taskType) {
      case 'illustration':
        // Search for professional illustration references
        return `professional ${this._extractSubject(userMessage)} illustration design reference high quality`;
      case 'logo':
        return `professional logo design ${this._extractSubject(userMessage)} best practices`;
      case 'presentation':
        return `professional presentation design ${this._extractSubject(userMessage)} template best practices`;
      case 'spreadsheet':
        return `professional Excel spreadsheet ${this._extractSubject(userMessage)} template format`;
      case 'website':
        return `best web design ${this._extractSubject(userMessage)} UI reference`;
      default:
        return null; // Don't search for generic tasks
    }
  }

  _detectTaskType(userMessage, plan) {
    const msg = (userMessage || '').toLowerCase();
    const tools = plan.subtasks?.flatMap(s => s.tools || []) || [];

    // Check message keywords first (works even if plan tools aren't set)
    if (msg.match(/ロゴ|logo|アイコン|icon/)) return 'logo';
    if (msg.match(/イラスト|描いて|描く|draw|illustrat|絵を|paint|sketch|図|デザイン/)) return 'illustration';
    if (msg.match(/サイト|web|ページ|page|ダッシュボード|dashboard/)) return 'website';
    if (msg.match(/プレゼン|スライド|presentation|slides|pptx|powerpoint|keynote/)) return 'presentation';
    if (msg.match(/エクセル|excel|spreadsheet|スプレッドシート|表|xlsx|csv/)) return 'spreadsheet';

    // Check tools in plan
    if (tools.includes('generate_svg') || tools.includes('generate_html')) return 'illustration';
    if (tools.includes('create_presentation')) return 'presentation';
    if (tools.includes('write_excel')) return 'spreadsheet';

    return 'general';
  }

  _extractSubject(message) {
    // Extract the main subject from the message
    // Remove common Japanese particles and task words
    return message
      .replace(/[をのにでがはもとへからまでよりほどなどやし]/g, ' ')
      .replace(/(描いて|作って|書いて|作成|生成|デザイン|イラスト|ロゴ|SVG|HTML|Illustrator|Excel|PowerPoint)/gi, '')
      .replace(/[、。！？]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 1)
      .slice(0, 4)
      .join(' ');
  }
}
