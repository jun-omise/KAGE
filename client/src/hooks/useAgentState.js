import { useState, useEffect, useRef } from 'react';

const INITIAL_AGENTS = {
  sentinel: { status: 'idle', logs: [], progress: 0 },
  planner: { status: 'idle', logs: [], progress: 0 },
  executor: { status: 'idle', logs: [], progress: 0 },
  reviewer: { status: 'idle', logs: [], progress: 0 },
};

export function useAgentState(sseAgentStates, sseCost, sseIsPaused) {
  const [agents, setAgents] = useState(INITIAL_AGENTS);
  const [cost, setCost] = useState({ current: 0, limit: 10.0 });
  const [elapsed, setElapsed] = useState(0);
  const [toolsUsed, setToolsUsed] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (sseAgentStates) {
      setAgents(sseAgentStates);

      const anyActive = Object.values(sseAgentStates).some(
        a => a.status === 'active' || a.status === 'running'
      );

      if (anyActive && !isRunningRef.current) {
        isRunningRef.current = true;
        setElapsed(0);
        timerRef.current = setInterval(() => {
          setElapsed(prev => prev + 1);
        }, 1000);
      } else if (!anyActive && isRunningRef.current) {
        isRunningRef.current = false;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }

      const tools = new Set();
      Object.values(sseAgentStates).forEach(agent => {
        agent.logs.forEach(log => {
          if (log.type === 'tool_call' && log.tool) {
            tools.add(log.tool);
          }
        });
      });
      setToolsUsed(Array.from(tools));
    }
  }, [sseAgentStates]);

  useEffect(() => {
    if (sseCost) {
      setCost(sseCost);
    }
  }, [sseCost]);

  useEffect(() => {
    setIsPaused(sseIsPaused || false);
  }, [sseIsPaused]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    agents,
    cost,
    elapsed,
    toolsUsed,
    isPaused,
  };
}
