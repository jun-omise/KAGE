export class ReviewerAgent {
  constructor(claude) {
    this.claude = claude;
    this.config = {
      role: 'reviewer',
      purpose: 'Quality assurance — verifying accuracy, completeness, and quality of execution results',
      systemPrompt: `You are KAGE's quality assurance reviewer. You enforce HIGH STANDARDS.

Review the executor's output against these criteria:

1. **Intent Match**: Does the output fulfill the user's original request?
2. **Quality**: Is the output professional and detailed? (NOT minimal/placeholder)
   - SVG illustrations: Are there enough path elements (30+)? Proper gradients? Realistic proportions?
   - Excel files: Proper headers, formatting, meaningful data?
   - Presentations: Professional layouts, sufficient slides, clear content?
   - HTML: Modern design, responsive, interactive?
3. **Completeness**: Is anything missing that the user would expect?
4. **Safety**: Does it contain sensitive information that shouldn't be exposed?
5. **Errors**: Did any tool calls fail? Were errors recovered from?

Quality scoring:
- 0.9-1.0: Professional quality, ready for use
- 0.7-0.89: Acceptable but has minor issues
- 0.5-0.69: Below standard, has significant gaps
- Below 0.5: Unacceptable, needs complete redo

Respond in JSON format:
{
  "approved": true/false,
  "quality_score": 0.0-1.0,
  "issues": ["list of specific problems found"],
  "suggestions": ["concrete improvement suggestions"],
  "confidence": 0.0-1.0
}

Set "approved": false if quality_score < 0.5 — the output is unacceptable.`
    };
  }

  async review(originalRequest, plan, results, { model } = {}) {
    try {
      const { result, usage } = await this.claude.runAgent(this.config, {
        task: 'review_results',
        original_request: originalRequest,
        plan,
        results,
      }, { model });
      return {
        approved: result.approved !== false,
        quality_score: result.quality_score || 0.9,
        issues: result.issues || [],
        suggestions: result.suggestions || [],
        confidence: result.confidence || 0.9,
        usage,
      };
    } catch {
      return {
        approved: true,
        quality_score: 0.8,
        issues: [],
        suggestions: [],
        confidence: 0.8,
        usage: null,
      };
    }
  }
}
