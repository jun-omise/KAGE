import React from 'react';
import { Check, Loader2, Circle } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const PIPELINE_STEPS = [
  { phase: 'sentinel_input', agent: 'sentinel', icon: '\uD83D\uDEE1\uFE0F' },
  { phase: 'planning', agent: 'planner', icon: '\uD83E\uDDE0' },
  { phase: 'sentinel_plan', agent: 'sentinel', icon: '\uD83D\uDEE1\uFE0F' },
  { phase: 'execution', agent: 'executor', icon: '\u26A1' },
  { phase: 'review', agent: 'reviewer', icon: '\uD83D\uDCCB' },
  { phase: 'response', agent: null, icon: '\u2728' },
];

function formatDuration(ms) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function PipelineTimeline({ pipelineProgress, agents, subtaskProgress }) {
  const { t } = useI18n();

  const currentPhaseIndex = pipelineProgress
    ? PIPELINE_STEPS.findIndex(s => s.phase === pipelineProgress.phase)
    : -1;

  return (
    <div className="space-y-1 py-2">
      {PIPELINE_STEPS.map((step, i) => {
        const isComplete = i < currentPhaseIndex;
        const isActive = i === currentPhaseIndex;
        const isPending = i > currentPhaseIndex;
        const agentState = step.agent ? agents[step.agent] : null;

        // Get detail info from agent state
        const detail = agentState?.detail;
        const agentLogs = agentState?.logs || [];
        const lastLog = agentLogs[agentLogs.length - 1];

        // Find trace duration for completed steps
        const duration = isComplete && lastLog?.timestamp
          ? null // We don't have exact duration here
          : null;

        return (
          <div key={step.phase} className="flex gap-3">
            {/* Timeline line + node */}
            <div className="flex flex-col items-center w-6 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                  isComplete
                    ? 'bg-kage-success/20 text-kage-success'
                    : isActive
                    ? 'bg-kage-primary/20 text-kage-primary ring-2 ring-kage-primary/40 animate-pulse-glow'
                    : 'bg-kage-bg text-kage-sub'
                }`}
              >
                {isComplete ? (
                  <Check size={12} />
                ) : isActive ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Circle size={8} />
                )}
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  className={`w-0.5 flex-1 min-h-[16px] transition-colors duration-300 ${
                    isComplete ? 'bg-kage-success/40' : 'bg-kage-border'
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-3 ${isPending ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm">{step.icon}</span>
                <span className={`text-sm font-medium ${isActive ? 'text-kage-primary' : 'text-kage-text'}`}>
                  {t(`progress.phases.${step.phase}`) || step.phase}
                </span>
                {step.agent && (
                  <span className="text-xs text-kage-sub">({t(`agents.${step.agent}`)})</span>
                )}
              </div>

              {/* Active step detail */}
              {isActive && detail && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-kage-sub">{detail.currentAction}</p>
                  {detail.toolName && (
                    <span className="inline-flex items-center gap-1 text-xs bg-kage-primary/10 text-kage-primary px-1.5 py-0.5 rounded">
                      \u25B6 {detail.toolName}
                    </span>
                  )}
                </div>
              )}

              {/* Subtask progress for execution phase */}
              {isActive && step.phase === 'execution' && subtaskProgress && (
                <div className="mt-1 text-xs text-kage-sub">
                  Subtask {subtaskProgress.subtaskIndex + 1}/{subtaskProgress.totalSubtasks}: {subtaskProgress.description}
                </div>
              )}

              {/* Completed step summary */}
              {isComplete && lastLog && (
                <p className="text-xs text-kage-sub mt-0.5 truncate">
                  {lastLog.message || (lastLog.type === 'tool_call' ? `\u25B6 ${lastLog.tool}` : '\u2713 Done')}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
