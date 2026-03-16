import { useState, useEffect, useRef, useCallback } from 'react';

const INITIAL_STATE = {
  agentStates: {
    sentinel: { status: 'idle', logs: [], progress: 0, detail: null },
    planner: { status: 'idle', logs: [], progress: 0, detail: null },
    executor: { status: 'idle', logs: [], progress: 0, detail: null },
    reviewer: { status: 'idle', logs: [], progress: 0, detail: null },
  },
  cost: { current: 0, limit: 10.0 },
  approval: null,
  isConnected: false,
  responseChunks: [],
  isPaused: false,
  pipelineProgress: null,
  subtaskProgress: null,
  fileResults: [],
  mcpAutoConnect: [],
};

export function useSSE(conversationId) {
  const [state, setState] = useState(INITIAL_STATE);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (!conversationId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/stream/${conversationId}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setState(prev => ({ ...prev, isConnected: true }));
    };

    es.onerror = () => {
      setState(prev => ({ ...prev, isConnected: false }));
      es.close();
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    // Helper: safely update agent state (skip unknown agents like 'system')
    const safeAgentUpdate = (prev, agent, updater) => {
      if (!prev.agentStates[agent]) return prev;
      const current = prev.agentStates[agent];
      return {
        ...prev,
        agentStates: {
          ...prev.agentStates,
          [agent]: updater(current),
        },
      };
    };

    es.addEventListener('agent:start', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => safeAgentUpdate(prev, data.agent, (cur) => ({
        ...cur,
        status: 'active',
        logs: [...(cur.logs || []), { type: 'start', message: data.message, timestamp: Date.now() }],
      })));
    });

    es.addEventListener('agent:thinking', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => safeAgentUpdate(prev, data.agent, (cur) => ({
        ...cur,
        status: 'running',
        logs: [...(cur.logs || []), { type: 'thinking', message: data.thought, timestamp: Date.now() }],
      })));
    });

    es.addEventListener('agent:tool_call', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => safeAgentUpdate(prev, data.agent, (cur) => ({
        ...cur,
        status: 'running',
        logs: [...(cur.logs || []), { type: 'tool_call', tool: data.tool, args: data.args, timestamp: Date.now() }],
      })));
    });

    es.addEventListener('agent:tool_result', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => safeAgentUpdate(prev, data.agent, (cur) => ({
        ...cur,
        logs: [...(cur.logs || []), { type: 'tool_result', result: data.result, timestamp: Date.now() }],
        progress: data.progress ?? cur.progress,
      })));
    });

    es.addEventListener('agent:complete', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => {
        const updated = safeAgentUpdate(prev, data.agent, (cur) => ({
          ...cur,
          status: 'complete',
          progress: 100,
          logs: [...(cur.logs || []), { type: 'complete', message: data.message, timestamp: Date.now() }],
        }));
        return { ...updated, cost: data.cost ?? prev.cost };
      });
    });

    es.addEventListener('approval:required', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        approval: {
          id: data.id,
          agent: data.agent,
          action: data.action,
          tool: data.tool,
          permissions: data.permissions || [],
          estimatedCost: data.estimatedCost || 0,
          description: data.description || '',
        },
      }));
    });

    es.addEventListener('response:chunk', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        responseChunks: [...prev.responseChunks, data.chunk],
      }));
    });

    es.addEventListener('response:done', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        cost: data.cost ?? prev.cost,
      }));
    });

    es.addEventListener('agent:paused', () => {
      setState(prev => ({ ...prev, isPaused: true }));
    });

    es.addEventListener('agent:resumed', () => {
      setState(prev => ({ ...prev, isPaused: false }));
    });

    // Pipeline progress events
    es.addEventListener('pipeline:progress', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        pipelineProgress: {
          phase: data.phase,
          stepIndex: data.stepIndex,
          totalSteps: data.totalSteps,
          description: data.description,
          elapsed_ms: data.elapsed_ms,
        },
      }));
    });

    es.addEventListener('executor:subtask_progress', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        subtaskProgress: {
          subtaskIndex: data.subtaskIndex,
          totalSubtasks: data.totalSubtasks,
          description: data.description,
          estimatedRemaining_ms: data.estimatedRemaining_ms,
        },
      }));
    });

    // Agent detail events
    es.addEventListener('agent:detail', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => safeAgentUpdate(prev, data.agent, (cur) => ({
        ...cur,
        detail: {
          currentAction: data.currentAction,
          toolName: data.toolName || null,
          inputPreview: data.inputPreview || null,
          outputPreview: data.outputPreview || null,
          tokenCount: data.tokenCount || null,
          costEstimate: data.costEstimate || null,
        },
      })));
    });

    // Result events
    es.addEventListener('result:file', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        fileResults: [...prev.fileResults, data],
      }));
    });

    // MCP auto-connect events
    es.addEventListener('mcp:auto_connecting', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        mcpAutoConnect: [...prev.mcpAutoConnect, { serverId: data.serverId, serverName: data.serverName, status: 'connecting' }],
      }));
    });

    es.addEventListener('mcp:auto_connected', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        mcpAutoConnect: prev.mcpAutoConnect.map(s =>
          s.serverId === data.serverId ? { ...s, status: 'connected', tools: data.tools } : s
        ),
      }));
    });

    es.addEventListener('mcp:auto_failed', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        mcpAutoConnect: prev.mcpAutoConnect.map(s =>
          s.serverId === data.serverId ? { ...s, status: 'failed', error: data.error } : s
        ),
      }));
    });

    es.addEventListener('mcp:env_required', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        mcpAutoConnect: [...prev.mcpAutoConnect, { serverId: data.serverId, serverName: data.serverName, status: 'env_required', missingKeys: data.missingKeys }],
      }));
    });

    // Pipeline routing info
    es.addEventListener('pipeline:routing', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => ({
        ...prev,
        pipelineRouting: data,
      }));
    });

    es.addEventListener('agent:warning', (e) => {
      const data = JSON.parse(e.data);
      setState(prev => {
        const targetAgent = prev.agentStates[data.agent] ? data.agent : 'sentinel';
        return {
          ...prev,
          agentStates: {
            ...prev.agentStates,
            [targetAgent]: {
              ...prev.agentStates[targetAgent],
              logs: [...(prev.agentStates[targetAgent]?.logs || []), { type: 'warning', message: data.message, timestamp: Date.now() }],
            },
          },
        };
      });
    });
  }, [conversationId]);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const clearApproval = useCallback(() => {
    setState(prev => ({ ...prev, approval: null }));
  }, []);

  const clearResponseChunks = useCallback(() => {
    setState(prev => ({ ...prev, responseChunks: [] }));
  }, []);

  const resetAgentStates = useCallback(() => {
    setState(prev => ({
      ...prev,
      agentStates: INITIAL_STATE.agentStates,
      isPaused: false,
      pipelineProgress: null,
      subtaskProgress: null,
      fileResults: [],
      mcpAutoConnect: [],
      pipelineRouting: null,
    }));
  }, []);

  const clearFileResults = useCallback(() => {
    setState(prev => ({ ...prev, fileResults: [] }));
  }, []);

  return {
    agentStates: state.agentStates,
    cost: state.cost,
    approval: state.approval,
    isConnected: state.isConnected,
    responseChunks: state.responseChunks,
    isPaused: state.isPaused,
    pipelineProgress: state.pipelineProgress,
    subtaskProgress: state.subtaskProgress,
    fileResults: state.fileResults,
    mcpAutoConnect: state.mcpAutoConnect,
    pipelineRouting: state.pipelineRouting,
    clearApproval,
    clearResponseChunks,
    resetAgentStates,
    clearFileResults,
  };
}
