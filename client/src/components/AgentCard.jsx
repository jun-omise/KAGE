import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import JsonViewer from './JsonViewer';

const AGENT_ICONS = {
  sentinel: '\uD83D\uDEE1\uFE0F',
  planner: '\uD83E\uDDE0',
  executor: '\u26A1',
  reviewer: '\uD83D\uDCCB',
};

const STATUS_BADGES = {
  idle: 'kage-badge-idle',
  active: 'kage-badge-active',
  running: 'kage-badge-active',
  waiting: 'kage-badge-warning',
  complete: 'kage-badge-active',
  error: 'kage-badge-error',
};

export default function AgentCard({ name, status, logs, progress, detail }) {
  const { t } = useI18n();
  const logsEndRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const isActive = status === 'active' || status === 'running';

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const statusKey = `agents.status.${status}`;
  const badgeClass = STATUS_BADGES[status] || 'kage-badge-idle';

  // Find the last tool call log for expanded view
  const toolCallLogs = logs?.filter(l => l.type === 'tool_call') || [];
  const toolResultLogs = logs?.filter(l => l.type === 'tool_result') || [];

  return (
    <div
      className={`kage-card p-3 transition-all duration-300 ${
        isActive ? 'ring-1 ring-kage-primary/40 shadow-lg shadow-kage-primary/5' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-base ${isActive ? 'animate-pulse-glow' : ''}`}>
            {AGENT_ICONS[name] || '\uD83E\uDD16'}
          </span>
          <span className="text-sm font-medium text-kage-text">
            {t(`agents.${name}`)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {detail?.toolName && isActive && (
            <span className="text-xs bg-kage-primary/10 text-kage-primary px-1.5 py-0.5 rounded truncate max-w-[120px]">
              {detail.toolName}
            </span>
          )}
          <span className={badgeClass}>
            {t(statusKey)}
          </span>
        </div>
      </div>

      {/* Current action subtitle */}
      {detail?.currentAction && (status === 'active' || status === 'running' || status === 'complete') && (
        <p className="text-xs text-kage-sub mb-1 truncate pl-7">
          {detail.currentAction}
        </p>
      )}

      {/* Progress bar (for executor) */}
      {name === 'executor' && progress > 0 && (
        <div className="mb-2">
          <div className="w-full h-1.5 bg-kage-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-kage-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className="text-xs text-kage-sub mt-0.5">{progress}%</span>
        </div>
      )}

      {/* Compact logs */}
      {logs && logs.length > 0 && (
        <div className={`mt-1 space-y-0.5 ${expanded ? '' : 'max-h-24 overflow-y-auto'}`}>
          {(expanded ? logs : logs.slice(-5)).map((log, i) => (
            <div key={i} className="text-xs text-kage-sub flex items-start gap-1.5">
              <span className="text-kage-sub/50 flex-shrink-0">
                {log.type === 'tool_call' ? '\u25B6' : log.type === 'thinking' ? '\u25CB' : log.type === 'complete' ? '\u2713' : log.type === 'warning' ? '\u26A0' : '\u2022'}
              </span>
              <span className="truncate">
                {log.type === 'tool_call'
                  ? `${log.tool}(${log.args ? JSON.stringify(log.args).slice(0, 60) : ''})`
                  : log.message || log.result || ''
                }
              </span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      )}

      {/* Expand/collapse for detailed view */}
      {(logs?.length > 5 || toolCallLogs.length > 0) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-1.5 text-xs text-kage-sub hover:text-kage-text transition-colors w-full"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {expanded ? t('agents.collapseLog') : t('agents.expandLog')}
        </button>
      )}

      {/* Expanded detail: tool call JSON */}
      {expanded && toolCallLogs.length > 0 && (
        <div className="mt-2 space-y-2">
          {toolCallLogs.slice(-3).map((tc, i) => (
            <JsonViewer
              key={i}
              data={{ tool: tc.tool, args: tc.args }}
              maxLines={6}
              label={`Tool Call #${toolCallLogs.length - 2 + i > 0 ? toolCallLogs.length - 2 + i : i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Input/Output previews */}
      {expanded && detail && (
        <div className="mt-2 space-y-1">
          {detail.inputPreview && (
            <div className="text-xs">
              <span className="text-kage-sub font-medium">{t('agents.inputPreview')}: </span>
              <span className="text-kage-text">{detail.inputPreview}</span>
            </div>
          )}
          {detail.outputPreview && (
            <div className="text-xs">
              <span className="text-kage-sub font-medium">{t('agents.outputPreview')}: </span>
              <span className="text-kage-text">{detail.outputPreview}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
