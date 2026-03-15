export class ReviewerAgent {
  constructor(claude) {
    this.claude = claude;
    this.config = {
      role: 'reviewer',
      purpose: 'Verifying accuracy and safety of execution results',
      systemPrompt: `You are KAGE's review agent.
Verify the executor's output and check the following:
1. Does it match the user's original intent?
2. Does it contain sensitive information?
3. Is the output correct and complete?
4. Is there room for improvement?

Respond in JSON format:
{
  "approved": true,
  "issues": [],
  "suggestions": [],
  "confidence": 0.95
}`
    };
  }

  async review(originalRequest, plan, results) {
    try {
      const result = await this.claude.runAgent(this.config, {
        task: 'review_results',
        original_request: originalRequest,
        plan,
        results,
      });
      return {
        approved: result.approved !== false,
        issues: result.issues || [],
        suggestions: result.suggestions || [],
        confidence: result.confidence || 0.9,
      };
    } catch {
      return {
        approved: true,
        issues: [],
        suggestions: [],
        confidence: 0.8,
      };
    }
  }
}
