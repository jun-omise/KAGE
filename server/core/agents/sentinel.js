/**
 * SentinelAgent — Security gatekeeper.
 * Validates input, plans, and output using AI + local security checks.
 * Integrates PII detector, permission engine, and cost tracker.
 */
import { detectPII, maskPII } from '../../security/pii-detector.js';
import { checkPermission } from '../../security/permission-engine.js';

export class SentinelAgent {
  constructor(claude) {
    this.claude = claude;
    this.config = {
      role: 'sentinel',
      purpose: 'Security monitoring, cost control, anomaly detection',
      systemPrompt: `You are KAGE's security sentinel. You respond ONLY in JSON. No explanations, no text outside JSON.

Check input/plan for:
1. PII (credit cards, SSN, phone numbers, API keys)
2. Cost exceeding limits
3. Unauthorized tool usage
4. Dangerous operations (file deletion, external API writes)

Respond with ONLY this JSON:
{"blocked":false,"reason":null,"warnings":[],"pii_detected":false,"risk_level":"low","requires_approval":false,"approval_reason":null}`
    };
  }

  async validateInput(userMessage, { model } = {}) {
    try {
      // Local PII detection first (fast, no API cost)
      const localPII = detectPII(userMessage);
      const localPIIDetected = localPII.length > 0;
      const localWarnings = localPII.length > 0
        ? [`PII detected locally: ${localPII.map(f => f.type).join(', ')}`]
        : [];

      // AI-based validation
      const { result, usage } = await this.claude.runAgent(this.config, {
        task: 'validate_input',
        input: userMessage,
      }, { model, maxTokens: 200 });

      return {
        blocked: result.blocked || false,
        reason: result.reason || null,
        warnings: [...(result.warnings || []), ...localWarnings],
        pii_detected: result.pii_detected || localPIIDetected,
        pii_findings: localPII,
        risk_level: result.risk_level || 'low',
        usage,
      };
    } catch {
      // Even if AI fails, still return local PII results
      const localPII = detectPII(userMessage);
      return {
        blocked: false,
        reason: null,
        warnings: localPII.length > 0 ? [`PII detected: ${localPII.map(f => f.type).join(', ')}`] : [],
        pii_detected: localPII.length > 0,
        pii_findings: localPII,
        risk_level: 'low',
        usage: null,
      };
    }
  }

  async validatePlan(plan, { model } = {}) {
    try {
      // Local permission checks for planned tools
      const permissionWarnings = [];
      let requiresApproval = false;
      let approvalReason = null;

      const subtasks = plan.subtasks || [];
      for (const subtask of subtasks) {
        const tools = subtask.tools || [];
        for (const toolName of tools) {
          const permCheck = checkPermission(toolName);
          if (permCheck.requiresApproval) {
            requiresApproval = true;
            approvalReason = approvalReason || permCheck.reason;
            permissionWarnings.push(`${toolName}: ${permCheck.reason}`);
          }
        }
      }

      // AI-based plan validation
      const { result, usage } = await this.claude.runAgent(this.config, {
        task: 'validate_plan',
        plan,
      }, { model, maxTokens: 200 });

      return {
        approved: result.approved !== false,
        requires_approval: result.requires_approval || requiresApproval,
        approval_reason: result.approval_reason || approvalReason,
        warnings: [...(result.warnings || []), ...permissionWarnings],
        permission_checks: permissionWarnings,
        usage,
      };
    } catch {
      // Even if AI fails, still return permission check results
      const permissionWarnings = [];
      let requiresApproval = false;
      let approvalReason = null;

      for (const subtask of (plan.subtasks || [])) {
        for (const toolName of (subtask.tools || [])) {
          const permCheck = checkPermission(toolName);
          if (permCheck.requiresApproval) {
            requiresApproval = true;
            approvalReason = approvalReason || permCheck.reason;
            permissionWarnings.push(`${toolName}: ${permCheck.reason}`);
          }
        }
      }

      return {
        approved: true,
        requires_approval: requiresApproval,
        approval_reason: approvalReason,
        warnings: permissionWarnings,
        permission_checks: permissionWarnings,
        usage: null,
      };
    }
  }

  async validateOutput(output, { model } = {}) {
    try {
      // Local PII check on output (fast)
      const outputText = typeof output === 'string' ? output : JSON.stringify(output);
      const localPII = detectPII(outputText);

      const { result, usage } = await this.claude.runAgent(this.config, {
        task: 'validate_output',
        output,
      }, { model, maxTokens: 200 });

      return {
        safe: result.safe !== false,
        pii_detected: result.pii_detected || localPII.length > 0,
        pii_findings: localPII,
        warnings: result.warnings || [],
        usage,
      };
    } catch {
      const outputText = typeof output === 'string' ? output : JSON.stringify(output);
      const localPII = detectPII(outputText);
      return {
        safe: true,
        pii_detected: localPII.length > 0,
        pii_findings: localPII,
        warnings: [],
        usage: null,
      };
    }
  }

  /**
   * Mask PII in text — convenience wrapper.
   */
  maskText(text) {
    return maskPII(text);
  }
}
