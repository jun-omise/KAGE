import React, { useState, useCallback } from 'react';
import {
  Play, Pencil, Trash2, Clock, Zap, Globe, Hand,
  ToggleLeft, ToggleRight, Loader2, CheckCircle, XCircle,
} from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const TRIGGER_ICONS = {
  schedule: Clock,
  manual: Hand,
  webhook: Globe,
  event: Zap,
};

const TRIGGER_BADGES = {
  schedule: 'kage-badge-active',
  manual: 'kage-badge-idle',
  webhook: 'kage-badge-warning',
  event: 'kage-badge-active',
};

export default function TaskCard({ task, onEdit, onDelete, onRun, onToggle }) {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const TriggerIcon = TRIGGER_ICONS[task.trigger] || Clock;
  const triggerBadge = TRIGGER_BADGES[task.trigger] || 'kage-badge-idle';

  const handleRun = useCallback(async () => {
    setRunning(true);
    try {
      await onRun(task.id);
    } finally {
      setRunning(false);
    }
  }, [task.id, onRun]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await onDelete(task.id);
    } catch {
      setDeleting(false);
    }
  }, [task.id, onDelete]);

  const isRunning = task.status === 'running' || running;

  return (
    <div
      className={`kage-card p-4 transition-all duration-300 ${
        isRunning ? 'ring-1 ring-kage-primary/40 shadow-lg shadow-kage-primary/5' : ''
      }`}
    >
      {/* Top row: name + trigger badge */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-3">
          <h4 className="text-sm font-semibold text-kage-text truncate">{task.name}</h4>
          {task.description && (
            <p className="text-xs text-kage-sub mt-0.5 line-clamp-2">{task.description}</p>
          )}
        </div>
        <span className={`${triggerBadge} flex items-center gap-1 flex-shrink-0`}>
          <TriggerIcon size={10} />
          {t(`tasks.${task.trigger || 'manual'}`)}
        </span>
      </div>

      {/* Last run info */}
      {task.lastRun && (
        <div className="flex items-center gap-3 mb-3 text-xs text-kage-sub">
          <div className="flex items-center gap-1">
            <Clock size={10} />
            {new Date(task.lastRun.time).toLocaleString()}
          </div>
          <div className="flex items-center gap-1">
            {task.lastRun.status === 'success' ? (
              <CheckCircle size={10} className="text-kage-success" />
            ) : task.lastRun.status === 'error' ? (
              <XCircle size={10} className="text-kage-danger" />
            ) : (
              <Loader2 size={10} className="animate-spin" />
            )}
            {task.lastRun.status}
          </div>
          {task.lastRun.cost != null && (
            <div className="font-mono">${task.lastRun.cost.toFixed(4)}</div>
          )}
        </div>
      )}

      {/* Cron expression display */}
      {task.trigger === 'schedule' && task.cron && (
        <div className="text-[10px] font-mono text-kage-sub bg-kage-bg rounded px-2 py-1 mb-3 inline-block">
          {task.cron}
        </div>
      )}

      {/* Footer: toggle + action buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-kage-border">
        {/* Enable/disable toggle */}
        <button
          onClick={() => onToggle(task.id, !task.enabled)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            task.enabled ? 'text-kage-success' : 'text-kage-sub'
          }`}
        >
          {task.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {task.enabled ? t('agents.status.active') : t('agents.status.idle')}
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="p-1.5 rounded-lg hover:bg-kage-primary/10 text-kage-sub hover:text-kage-primary transition-colors disabled:opacity-40"
            title={t('tasks.testRun')}
          >
            {isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors"
            title={t('common.settings')}
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-kage-danger/10 text-kage-sub hover:text-kage-danger transition-colors disabled:opacity-40"
            title={t('common.delete')}
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
