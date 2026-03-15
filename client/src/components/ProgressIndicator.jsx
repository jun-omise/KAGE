import React from 'react';
import { useI18n } from '../i18n/index.jsx';

const PHASES = ['sentinel_input', 'mcp_setup', 'planning', 'sentinel_plan', 'execution', 'review', 'response'];

const PHASE_ICONS = {
  sentinel_input: '\uD83D\uDEE1\uFE0F',
  mcp_setup: '\uD83D\uDD27',
  planning: '\uD83E\uDDE0',
  sentinel_plan: '\uD83D\uDEE1\uFE0F',
  execution: '\u26A1',
  review: '\uD83D\uDCCB',
  response: '\u2728',
};

function formatMs(ms) {
  if (!ms || ms < 0) return '--';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function ProgressIndicator({
  pipelineProgress,
  subtaskProgress,
  compact = false,
}) {
  const { t } = useI18n();

  if (!pipelineProgress) return null;

  const { phase, stepIndex, totalSteps, description, elapsed_ms } = pipelineProgress;
  const progress = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;

  // Determine which phases are complete/active/pending
  const currentPhaseIndex = PHASES.indexOf(phase);

  if (compact) {
    return (
      <div className="space-y-1.5">
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-kage-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-kage-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {/* Status text */}
        <div className="flex items-center justify-between text-xs text-kage-sub">
          <span className="flex items-center gap-1">
            <span className="animate-pulse-glow">{PHASE_ICONS[phase] || '\u2699\uFE0F'}</span>
            {description || t(`progress.phases.${phase}`) || phase}
          </span>
          <span>{formatMs(elapsed_ms)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Segmented progress bar */}
      <div className="flex gap-0.5">
        {PHASES.map((p, i) => {
          const isExecutionPhase = p === 'execution';
          // For execution phase, it spans multiple steps
          let segmentClass = 'bg-kage-bg';
          if (i < currentPhaseIndex) {
            segmentClass = 'bg-kage-success';
          } else if (i === currentPhaseIndex) {
            segmentClass = 'bg-kage-primary animate-pulse-glow';
          }

          return (
            <div
              key={p}
              className={`h-2 rounded-full transition-all duration-500 ${segmentClass} ${isExecutionPhase ? 'flex-[3]' : 'flex-1'}`}
              title={t(`progress.phases.${p}`) || p}
            />
          );
        })}
      </div>

      {/* Step info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-kage-text">
          <span className="animate-pulse-glow text-base">{PHASE_ICONS[phase] || '\u2699\uFE0F'}</span>
          <span className="font-medium">
            Step {stepIndex}/{totalSteps}
          </span>
          <span className="text-kage-sub">
            {description || t(`progress.phases.${phase}`) || phase}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-kage-sub">
          <span>{t('progress.elapsed')}: {formatMs(elapsed_ms)}</span>
          {subtaskProgress?.estimatedRemaining_ms > 0 && (
            <span>{t('progress.remaining')}: {formatMs(subtaskProgress.estimatedRemaining_ms)}</span>
          )}
        </div>
      </div>

      {/* Subtask progress (when in execution phase) */}
      {subtaskProgress && phase === 'execution' && (
        <div className="pl-7 space-y-1">
          <div className="flex items-center gap-2 text-xs text-kage-sub">
            <span className="text-kage-primary font-medium">
              Subtask {subtaskProgress.subtaskIndex + 1}/{subtaskProgress.totalSubtasks}
            </span>
            <span className="truncate">{subtaskProgress.description}</span>
          </div>
          <div className="w-full h-1 bg-kage-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-kage-primary/60 rounded-full transition-all duration-500"
              style={{ width: `${((subtaskProgress.subtaskIndex + 1) / subtaskProgress.totalSubtasks) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
