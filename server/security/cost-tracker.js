import { getDb } from '../db/init.js';

// Sonnet pricing: $3/MTok input, $15/MTok output
const INPUT_COST_PER_TOKEN = 3.0 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15.0 / 1_000_000;

export class CostTracker {
  /**
   * Calculate cost from token usage.
   */
  trackUsage(inputTokens, outputTokens) {
    const inputCost = inputTokens * INPUT_COST_PER_TOKEN;
    const outputCost = outputTokens * OUTPUT_COST_PER_TOKEN;
    const cost = inputCost + outputCost;
    return { cost, inputCost, outputCost };
  }

  /**
   * Get total cost for today (simple).
   */
  getTodayCost() {
    try {
      const db = getDb();
      const row = db.prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM cost_tracking WHERE date = date('now')"
      ).get();
      return row?.total || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get detailed daily cost data.
   * @param {string} [date] - Optional date string (YYYY-MM-DD), defaults to today
   * @returns {{ cost: number, inputTokens: number, outputTokens: number, taskCount: number }}
   */
  getDailyCost(date) {
    try {
      const db = getDb();
      const dateStr = date || new Date().toISOString().slice(0, 10);
      const row = db.prepare(
        "SELECT COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(input_tokens), 0) as inputTokens, COALESCE(SUM(output_tokens), 0) as outputTokens, COALESCE(SUM(task_count), 0) as taskCount FROM cost_tracking WHERE date = ?"
      ).get(dateStr);
      return {
        cost: row?.cost || 0,
        inputTokens: row?.inputTokens || 0,
        outputTokens: row?.outputTokens || 0,
        taskCount: row?.taskCount || 0,
      };
    } catch {
      return { cost: 0, inputTokens: 0, outputTokens: 0, taskCount: 0 };
    }
  }

  /**
   * Get total cost for this month (simple).
   */
  getMonthlyCost() {
    try {
      const db = getDb();
      const row = db.prepare(
        "SELECT COALESCE(SUM(cost), 0) as total FROM cost_tracking WHERE substr(date, 1, 7) = strftime('%Y-%m', 'now')"
      ).get();
      return row?.total || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get detailed monthly cost data.
   * @param {string} [month] - Optional month string (YYYY-MM), defaults to current
   * @returns {{ cost: number, inputTokens: number, outputTokens: number, taskCount: number }}
   */
  getDetailedMonthlyCost(month) {
    try {
      const db = getDb();
      const monthStr = month || new Date().toISOString().slice(0, 7);
      const row = db.prepare(
        "SELECT COALESCE(SUM(cost), 0) as cost, COALESCE(SUM(input_tokens), 0) as inputTokens, COALESCE(SUM(output_tokens), 0) as outputTokens, COALESCE(SUM(task_count), 0) as taskCount FROM cost_tracking WHERE substr(date, 1, 7) = ?"
      ).get(monthStr);
      return {
        cost: row?.cost || 0,
        inputTokens: row?.inputTokens || 0,
        outputTokens: row?.outputTokens || 0,
        taskCount: row?.taskCount || 0,
      };
    } catch {
      return { cost: 0, inputTokens: 0, outputTokens: 0, taskCount: 0 };
    }
  }

  /**
   * Check if daily or monthly cost limits have been exceeded.
   * Reads config from DB, no arguments needed.
   */
  checkLimits() {
    const daily = this.getTodayCost();
    const monthly = this.getMonthlyCost();

    // Read limits from config
    let dailyLimit = 10.00;
    let monthlyLimit = 100.00;
    try {
      const db = getDb();
      const row = db.prepare("SELECT value FROM config WHERE key = 'security_config'").get();
      if (row) {
        const config = JSON.parse(row.value);
        dailyLimit = config.cost?.daily_limit || 10.00;
        monthlyLimit = config.cost?.monthly_limit || 100.00;
      }
    } catch {}

    if (daily >= dailyLimit) {
      return {
        exceeded: true,
        reason: `Daily cost $${daily.toFixed(2)} exceeded limit of $${dailyLimit.toFixed(2)}`,
        daily,
        monthly,
      };
    }

    if (monthly >= monthlyLimit) {
      return {
        exceeded: true,
        reason: `Monthly cost $${monthly.toFixed(2)} exceeded limit of $${monthlyLimit.toFixed(2)}`,
        daily,
        monthly,
      };
    }

    return { exceeded: false, reason: '', daily, monthly };
  }

  /**
   * Check if an estimated cost would exceed limits.
   * @param {number} estimatedCost - The estimated cost of the next operation
   * @returns {{ allowed: boolean, reason: string|null, dailyRemaining: number, monthlyRemaining: number }}
   */
  checkLimit(estimatedCost = 0) {
    const daily = this.getTodayCost();
    const monthly = this.getMonthlyCost();

    let dailyLimit = 10.00;
    let monthlyLimit = 100.00;
    let perTaskLimit = 1.00;
    let alertThreshold = 0.80;
    try {
      const db = getDb();
      const row = db.prepare("SELECT value FROM config WHERE key = 'security_config'").get();
      if (row) {
        const config = JSON.parse(row.value);
        dailyLimit = config.cost?.daily_limit ?? config.costLimits?.daily ?? 10.00;
        monthlyLimit = config.cost?.monthly_limit ?? config.costLimits?.monthly ?? 100.00;
        perTaskLimit = config.cost?.per_task_limit ?? config.costLimits?.perTask ?? 1.00;
        alertThreshold = config.cost?.alert_threshold ?? 0.80;
      }
    } catch {}

    const dailyRemaining = Math.max(0, dailyLimit - daily);
    const monthlyRemaining = Math.max(0, monthlyLimit - monthly);

    if (estimatedCost > perTaskLimit) {
      return { allowed: false, reason: `Estimated cost $${estimatedCost.toFixed(4)} exceeds per-task limit of $${perTaskLimit.toFixed(2)}`, dailyRemaining, monthlyRemaining };
    }
    if (daily + estimatedCost > dailyLimit) {
      return { allowed: false, reason: `Would exceed daily limit ($${dailyLimit.toFixed(2)})`, dailyRemaining, monthlyRemaining };
    }
    if (monthly + estimatedCost > monthlyLimit) {
      return { allowed: false, reason: `Would exceed monthly limit ($${monthlyLimit.toFixed(2)})`, dailyRemaining, monthlyRemaining };
    }

    // 80% threshold alert
    const alertReason = [];
    if (daily / dailyLimit >= alertThreshold) alertReason.push(`Daily usage at ${Math.round(daily / dailyLimit * 100)}%`);
    if (monthly / monthlyLimit >= alertThreshold) alertReason.push(`Monthly usage at ${Math.round(monthly / monthlyLimit * 100)}%`);

    return {
      allowed: true,
      reason: alertReason.length > 0 ? alertReason.join('; ') : null,
      dailyRemaining,
      monthlyRemaining,
    };
  }

  /**
   * Record a cost entry to the cost_tracking table.
   * @param {number} cost - Total cost
   * @param {number|object} inputTokensOrMeta - Input tokens count, or metadata object (ignored for token tracking)
   * @param {number} [outputTokens] - Output tokens count
   */
  recordCost(cost, inputTokensOrMeta, outputTokens) {
    try {
      const db = getDb();
      const today = new Date().toISOString().slice(0, 10);
      const inputTokens = typeof inputTokensOrMeta === 'number' ? inputTokensOrMeta : 0;
      const outTokens = typeof outputTokens === 'number' ? outputTokens : 0;
      const existing = db.prepare("SELECT id FROM cost_tracking WHERE date = ?").get(today);
      if (existing) {
        db.prepare(
          "UPDATE cost_tracking SET cost = cost + ?, input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, task_count = task_count + 1 WHERE date = ?"
        ).run(cost, inputTokens, outTokens, today);
      } else {
        db.prepare(
          "INSERT INTO cost_tracking (id, date, cost, input_tokens, output_tokens, task_count) VALUES (?, ?, ?, ?, ?, 1)"
        ).run(`cost_${today}`, today, cost, inputTokens, outTokens);
      }
    } catch (err) {
      console.error('CostTracker recordCost error:', err.message);
    }
  }
}
