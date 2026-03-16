import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useTaskQueue - Hook for managing the parallel task queue
 * Connects to the global task queue SSE stream and provides
 * methods to submit, cancel, and monitor tasks.
 */
export function useTaskQueue() {
  const [tasks, setTasks] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectRef = useRef(null);

  // Connect to the global task queue SSE stream
  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/queue/stream');
    eventSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      reconnectRef.current = setTimeout(connect, 3000);
    };

    // Full state snapshot
    es.addEventListener('taskqueue:state', (e) => {
      const data = JSON.parse(e.data);
      setTasks(data.tasks || []);
    });

    // Individual task update
    es.addEventListener('taskqueue:update', (e) => {
      const data = JSON.parse(e.data);
      const updatedTask = data.task;
      setTasks(prev => {
        const idx = prev.findIndex(t => t.id === updatedTask.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updatedTask;
          return next;
        }
        return [updatedTask, ...prev];
      });
    });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [connect]);

  // Submit a single task
  const submitTask = useCallback(async (message, { priority, label } = {}) => {
    const res = await fetch('/api/queue/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, priority, label }),
    });
    if (!res.ok) throw new Error('Failed to submit task');
    return res.json();
  }, []);

  // Submit multiple tasks at once
  const submitBatch = useCallback(async (items) => {
    const res = await fetch('/api/queue/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: items }),
    });
    if (!res.ok) throw new Error('Failed to submit batch');
    return res.json();
  }, []);

  // Cancel a task
  const cancelTask = useCallback(async (taskId) => {
    const res = await fetch(`/api/queue/${taskId}/cancel`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to cancel task');
    return res.json();
  }, []);

  // Clear finished tasks
  const clearFinished = useCallback(async () => {
    const res = await fetch('/api/queue/clear', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear tasks');
    setTasks(prev => prev.filter(t => !['completed', 'failed', 'cancelled'].includes(t.status)));
    return res.json();
  }, []);

  // Computed stats
  const stats = {
    total: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    queued: tasks.filter(t => t.status === 'queued').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    cancelled: tasks.filter(t => t.status === 'cancelled').length,
    totalCost: tasks.reduce((sum, t) => sum + (t.cost || 0), 0),
  };

  return {
    tasks,
    stats,
    isConnected,
    submitTask,
    submitBatch,
    cancelTask,
    clearFinished,
  };
}
