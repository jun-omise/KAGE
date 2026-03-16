import React, { useState, useCallback } from 'react';
import {
  Play, Plus, X, Trash2, Clock, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Send, ChevronDown, ChevronUp,
  Zap, BarChart3, Layers,
} from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useTaskQueue } from '../hooks/useTaskQueue';

const STATUS_ICONS = {
  queued: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: X,
};

const STATUS_COLORS = {
  queued: 'text-kage-sub',
  running: 'text-kage-primary',
  completed: 'text-kage-success',
  failed: 'text-kage-danger',
  cancelled: 'text-kage-sub',
};

const PHASE_LABELS = {
  queued: 'Waiting',
  starting: 'Starting',
  sentinel_input: 'Security Check',
  mcp_setup: 'Connecting Tools',
  planning: 'Planning',
  sentinel_plan: 'Plan Review',
  execution: 'Executing',
  review: 'Reviewing',
  response: 'Generating Response',
  done: 'Done',
  error: 'Error',
};

const AGENT_LABELS = {
  sentinel: 'Sentinel',
  planner: 'Planner',
  executor: 'Executor',
  reviewer: 'Reviewer',
};

function TaskProgressBar({ progress }) {
  if (!progress || !progress.totalSteps) return null;
  const pct = Math.round((progress.stepIndex / progress.totalSteps) * 100);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-kage-sub mb-1">
        <span>{PHASE_LABELS[progress.phase] || progress.phase}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-kage-primary rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AgentPipeline({ agentStates }) {
  if (!agentStates) return null;
  const agents = ['sentinel', 'planner', 'executor', 'reviewer'];

  return (
    <div className="flex items-center gap-1 mt-2">
      {agents.map((agent, i) => {
        const state = agentStates[agent] || { status: 'idle' };
        const isActive = state.status === 'active' || state.status === 'running';
        const isDone = state.status === 'complete';

        return (
          <React.Fragment key={agent}>
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-all ${
                isActive
                  ? 'bg-kage-primary/20 text-kage-primary'
                  : isDone
                    ? 'bg-kage-success/10 text-kage-success'
                    : 'bg-white/5 text-kage-sub'
              }`}
              title={state.detail?.currentAction || ''}
            >
              {isActive && <Loader2 size={10} className="animate-spin" />}
              {isDone && <CheckCircle2 size={10} />}
              <span>{AGENT_LABELS[agent]}</span>
            </div>
            {i < agents.length - 1 && (
              <span className="text-kage-sub/30 text-xs">{'>'}</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function TaskCard({ task, onCancel, onExpand, isExpanded }) {
  const StatusIcon = STATUS_ICONS[task.status] || Clock;
  const statusColor = STATUS_COLORS[task.status] || 'text-kage-sub';
  const isRunning = task.status === 'running';
  const elapsed = task.startedAt
    ? ((task.completedAt || Date.now()) - task.startedAt) / 1000
    : 0;

  return (
    <div className={`kage-card p-4 transition-all ${
      isRunning ? 'ring-1 ring-kage-primary/30' : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <StatusIcon
            size={18}
            className={`mt-0.5 flex-shrink-0 ${statusColor} ${
              isRunning ? 'animate-spin' : ''
            }`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-kage-text truncate">
              {task.label}
            </p>
            {task.priority === 'high' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-kage-warning bg-kage-warning/10 px-1.5 py-0.5 rounded mt-0.5">
                <Zap size={8} /> HIGH
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {elapsed > 0 && (
            <span className="text-xs text-kage-sub">
              {elapsed < 60 ? `${Math.round(elapsed)}s` : `${Math.round(elapsed / 60)}m`}
            </span>
          )}
          {task.cost > 0 && (
            <span className="text-xs text-kage-sub">
              ${task.cost.toFixed(4)}
            </span>
          )}
          <button
            onClick={() => onExpand(task.id)}
            className="p-1 rounded hover:bg-white/5 text-kage-sub"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {(task.status === 'running' || task.status === 'queued') && (
            <button
              onClick={() => onCancel(task.id)}
              className="p-1 rounded hover:bg-kage-danger/10 text-kage-sub hover:text-kage-danger"
              title="Cancel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (running tasks) */}
      {isRunning && <TaskProgressBar progress={task.progress} />}

      {/* Agent pipeline (running tasks) */}
      {isRunning && <AgentPipeline agentStates={task.agentStates} />}

      {/* Subtask progress */}
      {isRunning && task.subtaskProgress && (
        <div className="mt-1.5 text-xs text-kage-sub">
          Subtask {task.subtaskProgress.subtaskIndex + 1}/{task.subtaskProgress.totalSubtasks}: {task.subtaskProgress.description}
        </div>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-kage-border">
          <p className="text-xs text-kage-sub mb-2">
            {task.message}
          </p>
          {task.result?.response && (
            <div className="bg-white/5 rounded-lg p-3 text-xs text-kage-text max-h-40 overflow-y-auto whitespace-pre-wrap">
              {task.result.response}
            </div>
          )}
          {task.error && !task.result?.response && (
            <div className="bg-kage-danger/10 rounded-lg p-3 text-xs text-kage-danger">
              {task.error}
            </div>
          )}
          {task.lastWarning && (
            <div className="flex items-center gap-1 mt-2 text-xs text-kage-warning">
              <AlertTriangle size={12} />
              {task.lastWarning}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TaskDashboard() {
  const { t } = useI18n();
  const {
    tasks,
    stats,
    isConnected,
    submitTask,
    submitBatch,
    cancelTask,
    clearFinished,
  } = useTaskQueue();

  const [inputMode, setInputMode] = useState('single'); // single | batch
  const [singleInput, setSingleInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitSingle = useCallback(async () => {
    if (!singleInput.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await submitTask(singleInput.trim());
      setSingleInput('');
    } catch (err) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [singleInput, submitTask, isSubmitting]);

  const handleSubmitBatch = useCallback(async () => {
    if (!batchInput.trim() || isSubmitting) return;
    const lines = batchInput.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;
    setIsSubmitting(true);
    try {
      const items = lines.map(line => ({ message: line.trim() }));
      await submitBatch(items);
      setBatchInput('');
    } catch (err) {
      console.error('Batch submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [batchInput, submitBatch, isSubmitting]);

  const toggleExpand = useCallback((taskId) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const runningTasks = tasks.filter(t => t.status === 'running');
  const queuedTasks = tasks.filter(t => t.status === 'queued');
  const finishedTasks = tasks.filter(t => ['completed', 'failed', 'cancelled'].includes(t.status));

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-kage-border bg-kage-card/50 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers size={16} className="text-kage-primary" />
          <span className="text-sm font-semibold text-kage-text">
            {t('queue.title') || 'Task Queue'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1 ${stats.running > 0 ? 'text-kage-primary' : 'text-kage-sub'}`}>
            <Loader2 size={12} className={stats.running > 0 ? 'animate-spin' : ''} />
            {stats.running} {t('queue.running') || 'running'}
          </span>
          <span className="text-kage-sub">
            {stats.queued} {t('queue.queued') || 'queued'}
          </span>
          <span className="text-kage-success">
            {stats.completed} {t('queue.done') || 'done'}
          </span>
          {stats.failed > 0 && (
            <span className="text-kage-danger">
              {stats.failed} {t('queue.failed') || 'failed'}
            </span>
          )}
          {stats.totalCost > 0 && (
            <span className="text-kage-sub">
              ${stats.totalCost.toFixed(4)}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-kage-success">
              <span className="w-1.5 h-1.5 rounded-full bg-kage-success animate-pulse-glow" />
              Live
            </span>
          )}
          {finishedTasks.length > 0 && (
            <button
              onClick={clearFinished}
              className="flex items-center gap-1 text-xs text-kage-sub hover:text-kage-text px-2 py-1 rounded hover:bg-white/5"
            >
              <Trash2 size={12} />
              {t('queue.clearFinished') || 'Clear finished'}
            </button>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 pt-4 pb-2 flex-shrink-0">
        {/* Mode toggle */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setInputMode('single')}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
              inputMode === 'single'
                ? 'bg-kage-primary/10 text-kage-primary font-medium'
                : 'text-kage-sub hover:text-kage-text hover:bg-white/5'
            }`}
          >
            {t('queue.single') || 'Single Task'}
          </button>
          <button
            onClick={() => setInputMode('batch')}
            className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
              inputMode === 'batch'
                ? 'bg-kage-primary/10 text-kage-primary font-medium'
                : 'text-kage-sub hover:text-kage-text hover:bg-white/5'
            }`}
          >
            <span className="flex items-center gap-1">
              <BarChart3 size={12} />
              {t('queue.batch') || 'Batch'}
            </span>
          </button>
        </div>

        {inputMode === 'single' ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={singleInput}
              onChange={e => setSingleInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmitSingle()}
              placeholder={t('queue.placeholder') || 'Describe a task to execute...'}
              className="kage-input flex-1 text-sm"
            />
            <button
              onClick={handleSubmitSingle}
              disabled={!singleInput.trim() || isSubmitting}
              className="kage-btn-primary px-4 flex items-center gap-1.5 disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        ) : (
          <div>
            <textarea
              value={batchInput}
              onChange={e => setBatchInput(e.target.value)}
              placeholder={t('queue.batchPlaceholder') || 'One task per line:\nCreate an Excel report of sales data\nTake a screenshot of the desktop\nList installed applications'}
              className="kage-input w-full text-sm min-h-[100px] resize-y"
              rows={4}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-kage-sub">
                {batchInput.split('\n').filter(l => l.trim()).length} {t('queue.tasksCount') || 'tasks'}
              </span>
              <button
                onClick={handleSubmitBatch}
                disabled={!batchInput.trim() || isSubmitting}
                className="kage-btn-primary px-4 py-1.5 flex items-center gap-1.5 text-sm disabled:opacity-40"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <>
                    <Play size={14} />
                    {t('queue.runAll') || 'Run All'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {/* Running tasks */}
        {runningTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-kage-primary uppercase tracking-wider mb-2 mt-2">
              {t('queue.running') || 'Running'} ({runningTasks.length})
            </h3>
            <div className="space-y-2">
              {runningTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onCancel={cancelTask}
                  onExpand={toggleExpand}
                  isExpanded={expandedTasks.has(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Queued tasks */}
        {queuedTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-kage-sub uppercase tracking-wider mb-2 mt-2">
              {t('queue.queued') || 'Queued'} ({queuedTasks.length})
            </h3>
            <div className="space-y-2">
              {queuedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onCancel={cancelTask}
                  onExpand={toggleExpand}
                  isExpanded={expandedTasks.has(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Finished tasks */}
        {finishedTasks.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-kage-sub uppercase tracking-wider mb-2 mt-2">
              {t('queue.finished') || 'Finished'} ({finishedTasks.length})
            </h3>
            <div className="space-y-2">
              {finishedTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onCancel={cancelTask}
                  onExpand={toggleExpand}
                  isExpanded={expandedTasks.has(task.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-kage-sub">
            <Layers size={48} className="mb-4 opacity-30" />
            <p className="text-sm font-medium mb-1">
              {t('queue.empty') || 'No tasks in queue'}
            </p>
            <p className="text-xs opacity-70">
              {t('queue.emptyHint') || 'Submit tasks above to run them in parallel'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
