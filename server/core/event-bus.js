/**
 * EventBus — internal event bus bridging agents to SSE.
 * Agents emit events here; the orchestrator forwards them to SSEManager.
 *
 * Event types:
 *   agent:start     — { agent, action }
 *   agent:thinking  — { agent, thought }
 *   agent:tool_call — { agent, tool, params }
 *   agent:complete  — { agent, durationMs }
 *   agent:error     — { agent, error }
 *   approval:required — { id, action, reason }
 *   orchestration:start — { conversationId }
 *   orchestration:done  — { conversationId, totalCost, totalTokens }
 */
import { EventEmitter } from 'events';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Bind this event bus to an SSE manager for a specific conversation.
   * Returns unbind function.
   */
  bindToSSE(sseManager, conversationId) {
    const forwardEvents = [
      'agent:start', 'agent:thinking', 'agent:tool_call',
      'agent:tool_result', 'agent:complete', 'agent:error',
      'agent:warning', 'agent:detail',
      'approval:required',
      'orchestration:start', 'orchestration:done',
    ];

    const handlers = {};
    for (const event of forwardEvents) {
      handlers[event] = (data) => {
        sseManager.send(conversationId, event, data);
      };
      this.on(event, handlers[event]);
    }

    // Return unbind function
    return () => {
      for (const event of forwardEvents) {
        this.removeListener(event, handlers[event]);
      }
    };
  }
}

// Singleton
const eventBus = new EventBus();
export default eventBus;
