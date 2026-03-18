import React from 'react';
import { Shield, Brain, Zap, ClipboardCheck, Wrench, Search, CheckCircle } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const PHASES = ['sentinel_input', 'mcp_setup', 'planning', 'sentinel_plan', 'execution', 'review', 'response'];

const PHASE_ICONS = {
  sentinel_input: Shield,
  mcp_setup: Wrench,
  planning: Brain,
  sentinel_plan: Shield,
  execution: Zap,
  review: ClipboardCheck,
  response: CheckCircle,
};

const PHASE_COLORS = {
  sentinel_input: 'text-yellow-400',
  mcp_setup: 'text-kage-sub',
  planning: 'text-purple-400',
  sentinel_plan: 'text-yellow-400',
  execution: 'text-blue-400',
  review: 'text-green-400',
  response: 'text-kage-primary',
};

function formatMs(ms) {
  if (!ms || ms < 0) return '--';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function getLatestToolCall(agentStates) {
  if (!agentStates) return null;
  for (const [name, state] of Object.entries(agentStates)) {
    if (state.status === 'active' || state.status === 'running') {
      const logs = state.logs || [];
      for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].type === 'tool_call') {
          return { agent: name, tool: logs[i].tool };
        }
      }
    }
  }
  return null;
}

export default function ProgressIndicator({
  pipelineProgress,
  subtaskProgress,
  agentStates,
  compact = false,
}) {
  const { t } = useI18n();

  if (!pipelineProgress) return null;

  const { phase, stepIndex, totalSteps, description, elapsed_ms } = pipelineProgress;
  const progress = totalSteps > 0 ? Math.round((stepIndex / totalSteps) * 100) : 0;
  const currentPhaseIndex = PHASES.indexOf(phase);
  const PhaseIcon = PHASE_ICONS[phase] || Wrench;
  const phaseColor = PHASE_COLORS[phase] || 'text-kage-sub';
  const liveToolCall = getLatestToolCall(agentStates);

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Phase stepper - horizontal dots */}
        <div className="flex items-center gap-1">
          {PHASES.map((p, i) => {
            const StepIcon = PHASE_ICONS[p] || Wrench;
            const isDone = i < currentPhaseIndex;
            const isActive = i === currentPhaseIndex;
            return (
              <div key={p} className="flex items-center">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                  isDone ? 'bg-kage-success/20' : isActive ? 'bg-kage-primary/20 animate-pulse' : 'bg-kage-bg'
                }`}>
                  <StepIcon size={10} className={
                    isDone ? 'text-kage-success' : isActive ? PHASE_COLORS[p] : 'text-kage-sub/40'
                  } />
                </div>
                {i < PHASES.length - 1 && (
                  <div className={`w-3 h-px ${isDone ? 'bg-kage-success/40' : 'bg-kage-border/30'}`} />
                )}
              </div>
            );
          })}
          <span className="text-[10px] text-kage-sub ml-auto">{formatMs(elapsed_ms)}</span>
        </div>

        {/* Current action */}
        <div className="flex items-center gap-1.5 text-xs">
          <PhaseIcon size={13} className={`${phaseColor} animate-pulse`} />
          <span className="text-kage-text font-medium">
            {description || t(`progress.phases.${phase}`) || phase}
          </span>
        </div>

        {/* Live tool call */}
        {liveToolCall && (
          <div className="flex items-center gap-1.5 text-xs text-kage-sub pl-5">
            <Wrench size={11} className="text-kage-primary" />
            <span className="font-mono truncate">{liveToolCall.tool}</span>
          </div>
        )}

        {/* Subtask progress */}
        {subtaskProgress && phase === 'execution' && (
          <div className="flex items-center gap-2 text-[11px] text-kage-sub pl-5">
            <span className="text-kage-primary font-medium">
              {subtaskProgress.subtaskIndex + 1}/{subtaskProgress.totalSubtasks}
            </span>
            <span className="truncate">{subtaskProgress.description}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Segmented progress bar */}
      <div className="flex gap-0.5">
        {PHASES.map((p, i) => {
          const isExecutionPhase = p === 'execution';
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
          <PhaseIcon size={16} className={`${phaseColor} animate-pulse`} />
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
