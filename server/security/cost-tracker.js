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
   * Get total cost for today.
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
   * Get total cost for this month.
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
