import React, { useState } from 'react';
import { Activity, Pause, Play, Square, ChevronRight, Clock, Wrench, LayoutList, GitBranch } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import AgentCard from './AgentCard';
import CostTracker from './CostTracker';
import ProgressIndicator from './ProgressIndicator';
import PipelineTimeline from './PipelineTimeline';

const AGENT_ORDER = ['sentinel', 'planner', 'executor', 'reviewer'];

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function AgentMonitor({
  agents,
  cost,
  elapsed,
  toolsUsed,
  isPaused,
  onPause,
  onResume,
  onStop,
  collapsed,
  onToggleCollapse,
  pipelineProgress,
  subtaskProgress,
}) {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState('cards');

  const anyActive = Object.values(agents).some(
    a => a.status === 'active' || a.status === 'running'
  );

  return (
    <aside
      className={`flex flex-col h-full bg-kage-card border-l border-kage-border transition-all duration-300
        ${collapsed ? 'w-0 overflow-hidden' : 'w-[380px]'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-kage-border">
        <div className="flex items-center gap-2">
          <Activity size={18} className={`${anyActive ? 'text-kage-success animate-pulse-glow' : 'text-kage-sub'}`} />
          <span className="text-sm font-semibold text-kage-text">{t('agents.monitor')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-1 rounded transition-colors ${viewMode === 'cards' ? 'bg-kage-primary/10 text-kage-primary' : 'text-kage-sub hover:text-kage-text'}`}
            title={t('agents.cards')}
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-1 rounded transition-colors ${viewMode === 'timeline' ? 'bg-kage-primary/10 text-kage-primary' : 'text-kage-sub hover:text-kage-text'}`}
            title={t('agents.timeline')}
          >
            <GitBranch size={14} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors ml-1"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {(elapsed > 0 || toolsUsed.length > 0) && (
        <div className="flex items-center gap-4 px-4 py-2 border-b border-kage-border text-xs text-kage-sub">
          {elapsed > 0 && (
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{formatElapsed(elapsed)}</span>
            </div>
          )}
          {toolsUsed.length > 0 && (
            <div className="flex items-center gap-1">
              <Wrench size={12} />
              <span>{toolsUsed.length} {t('agents.tools').toLowerCase()}</span>
            </div>
          )}
        </div>
      )}

      {/* Pipeline Progress Indicator */}
      {pipelineProgress && (
        <div className="px-3 py-3 border-b border-kage-border">
          <ProgressIndicator
            pipelineProgress={pipelineProgress}
            subtaskProgress={subtaskProgress}
          />
        </div>
      )}

      {/* Content: Cards or Timeline */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {viewMode === 'cards' ? (
          <div className="space-y-2">
            {AGENT_ORDER.map((name) => (
              <AgentCard
                key={name}
                name={name}
                status={agents[name]?.status || 'idle'}
                logs={agents[name]?.logs || []}
                progress={agents[name]?.progress || 0}
                detail={agents[name]?.detail || null}
              />
            ))}
          </div>
        ) : (
          <PipelineTimeline
            pipelineProgress={pipelineProgress}
            agents={agents}
            subtaskProgress={subtaskProgress}
          />
        )}
      </div>

      {/* Cost tracker */}
      <div className="px-3 pb-2">
        <CostTracker current={cost.current} limit={cost.limit} />
      </div>

      {/* Controls */}
      <div className="px-3 pb-3 flex gap-2">
        {isPaused ? (
          <button
            onClick={onResume}
            className="flex-1 kage-btn-primary flex items-center justify-center gap-1.5 text-sm"
          >
            <Play size={14} />
            {t('agents.resume')}
          </button>
        ) : (
          <button
            onClick={onPause}
            disabled={!anyActive}
            className={`flex-1 kage-btn-ghost flex items-center justify-center gap-1.5 text-sm border border-kage-border
              ${!anyActive ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Pause size={14} />
            {t('agents.pause')}
          </button>
        )}
        <button
          onClick={onStop}
          disabled={!anyActive && !isPaused}
          className={`flex-1 kage-btn-danger flex items-center justify-center gap-1.5 text-sm
            ${!anyActive && !isPaused ? 'opacity-40 cursor-not-allowed' : ''}`}
        >
          <Square size={14} />
          {t('agents.stop')}
        </button>
      </div>
    </aside>
  );
}
