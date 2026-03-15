export class SentinelAgent {
  constructor(claude) {
    this.claude = claude;
    this.config = {
      role: 'sentinel',
      purpose: 'Security monitoring, cost control, anomaly detection',
      systemPrompt: `You are KAGE's security monitoring agent.
Check all agent communications and enforce the following:
1. Cost limit: Stay within $1 per task (user configurable)
2. Loop prevention: Stop if the same tool call pattern repeats 3 times
3. Permission check: Ensure agents only use permitted tools
4. PII detection: Auto-mask credit card numbers, SSN, etc.

If danger is detected, immediately stop the task and notify the user.

Respond in JSON format:
{
  "blocked": false,
  "reason": null,
  "warnings": [],
  "pii_detected": false,
  "risk_level": "low"
}`
    };
  }

  async validateInput(userMessage) {
    try {
      const result = await this.claude.runAgent(this.config, {
        task: 'validate_input',
        input: userMessage,
      });
      return {
        blocked: result.blocked || false,
        reason: result.reason || null,
        warnings: result.warnings || [],
        pii_detected: result.pii_detected || false,
        risk_level: result.risk_level || 'low',
      };
    } catch {
      return { blocked: false, reason: null, warnings: [], pii_detected: false, risk_level: 'low' };
    }
  }

  async validatePlan(plan) {
    try {
      const result = await this.claude.runAgent(this.config, {
        task: 'validate_plan',
        plan,
      });
      return {
        approved: result.approved !== false,
        requires_approval: result.requires_approval || false,
        approval_reason: result.approval_reason || null,
        warnings: result.warnings || [],
      };
    } catch {
      return { approved: true, requires_approval: false, approval_reason: null, warnings: [] };
    }
  }

  async validateOutput(output) {
    try {
      const result = await this.claude.runAgent(this.config, {
        task: 'validate_output',
        output,
      });
      return {
        safe: result.safe !== false,
        pii_detected: result.pii_detected || false,
        warnings: result.warnings || [],
      };
    } catch {
      return { safe: true, pii_detected: false, warnings: [] };
    }
  }
}
