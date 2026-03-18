export class LoopDetector {
  constructor() {
    // taskId -> { toolName -> callCount }
    this.toolCalls = new Map();
    // taskId -> [{ from, to, timestamp }]
    this.agentBounces = new Map();
    // taskId -> { startTime, tokenCount }
    this.taskTimers = new Map();
  }

  /**
   * Track a tool call for a given task.
   */
  trackToolCall(taskId, toolName) {
    if (!this.toolCalls.has(taskId)) {
      this.toolCalls.set(taskId, new Map());
    }
    const calls = this.toolCalls.get(taskId);
    const count = calls.get(toolName) || 0;
    calls.set(toolName, count + 1);
  }

  /**
   * Track an agent-to-agent bounce for a given task.
   */
  trackAgentBounce(taskId, fromAgent, toAgent) {
    if (!this.agentBounces.has(taskId)) {
      this.agentBounces.set(taskId, []);
    }
    this.agentBounces.get(taskId).push({
      from: fromAgent,
      to: toAgent,
      timestamp: Date.now(),
    });
  }

  /**
   * Track token usage for a task.
   */
  trackTokens(taskId, tokenCount) {
    if (this.taskTimers.has(taskId)) {
      const timer = this.taskTimers.get(taskId);
      timer.tokenCount = (timer.tokenCount || 0) + tokenCount;
    }
  }

  /**
   * Check if any loop detection limits have been exceeded.
   * Returns { exceeded: boolean, reason: string }
   */
  checkLimits(taskId, config = {}) {
    const limits = config.loop_detection || {};

    // Check same tool call limit
    const toolCallMap = this.toolCalls.get(taskId);
    if (toolCallMap) {
      for (const [toolName, count] of toolCallMap.entries()) {
        if (count >= (limits.max_same_tool_calls || 3)) {
          return {
            exceeded: true,
            reason: `Tool "${toolName}" called ${count} times (limit: ${limits.max_same_tool_calls || 3})`,
          };
        }
      }
    }

    // Check agent bounce limit
    const bounces = this.agentBounces.get(taskId);
    if (bounces && bounces.length >= (limits.max_agent_bounces || 5)) {
      return {
        exceeded: true,
        reason: `Agent bounces reached ${bounces.length} (limit: ${limits.max_agent_bounces || 5})`,
      };
    }

    // Check task duration limit
    const timer = this.taskTimers.get(taskId);
    if (timer) {
      const elapsed = Date.now() - timer.startTime;
      if (elapsed >= (limits.max_task_duration_ms || 300000)) {
        return {
          exceeded: true,
          reason: `Task duration ${elapsed}ms exceeded limit of ${limits.max_task_duration_ms || 300000}ms`,
        };
      }

      // Check token limit
      if (timer.tokenCount >= (limits.max_tokens_per_task || 100000)) {
        return {
          exceeded: true,
          reason: `Token usage ${timer.tokenCount} exceeded limit of ${limits.max_tokens_per_task || 100000}`,
        };
      }
    }

    return { exceeded: false, reason: '' };
  }

  /**
   * Start timing a task.
   */
  startTask(taskId) {
    this.taskTimers.set(taskId, {
      startTime: Date.now(),
      tokenCount: 0,
    });
  }

  /**
   * Clean up all tracking data for a task.
   */
  cleanup(taskId) {
    this.toolCalls.delete(taskId);
    this.agentBounces.delete(taskId);
    this.taskTimers.delete(taskId);
  }
}
