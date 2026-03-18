import React, { useRef, useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react';
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

  // Pair tool calls with their results for rich display
  const toolPairs = useMemo(() => {
    const pairs = [];
    const resultsByTool = [...toolResultLogs];
    for (const tc of toolCallLogs) {
      const matchIdx = resultsByTool.findIndex(r => r.tool === tc.tool || r.subtaskId === tc.subtaskId);
      const result = matchIdx >= 0 ? resultsByTool.splice(matchIdx, 1)[0] : null;
      pairs.push({ call: tc, result });
    }
    return pairs;
  }, [toolCallLogs, toolResultLogs]);

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
              <span className="flex-shrink-0">
                {log.type === 'tool_call' ? (
                  <span className="text-kage-primary/70">▶</span>
                ) : log.type === 'tool_result' ? (
                  log.success === false
                    ? <XCircle size={11} className="text-red-400 mt-0.5" />
                    : <CheckCircle size={11} className="text-green-400 mt-0.5" />
                ) : log.type === 'thinking' ? (
                  <span className="text-kage-sub/50">○</span>
                ) : log.type === 'complete' ? (
                  <span className="text-green-400">✓</span>
                ) : log.type === 'warning' ? (
                  <span className="text-yellow-400">⚠</span>
                ) : (
                  <span className="text-kage-sub/50">•</span>
                )}
              </span>
              <span className="truncate flex-1">
                {log.type === 'tool_call'
                  ? `${log.tool}(${log.args ? JSON.stringify(log.args).slice(0, 60) : ''})`
                  : log.type === 'tool_result'
                    ? (log.result || (log.success === false ? 'Failed' : 'Done'))
                    : log.message || log.result || ''
                }
              </span>
              {log.type === 'tool_result' && log.duration_ms != null && (
                <span className="flex items-center gap-0.5 text-kage-sub/60 flex-shrink-0 ml-1">
                  <Clock size={10} />
                  {log.duration_ms < 1000 ? `${log.duration_ms}ms` : `${(log.duration_ms / 1000).toFixed(1)}s`}
                </span>
              )}
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

      {/* Expanded detail: tool call + result pairs */}
      {expanded && toolPairs.length > 0 && (
        <div className="mt-2 space-y-2">
          {toolPairs.slice(-3).map((pair, i) => (
            <div key={i} className="rounded bg-kage-bg/50 border border-kage-border/30 p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-kage-text flex items-center gap-1">
                  {pair.result?.success === false
                    ? <XCircle size={12} className="text-red-400" />
                    : pair.result
                      ? <CheckCircle size={12} className="text-green-400" />
                      : <span className="text-kage-primary/70">▶</span>
                  }
                  {pair.call.tool}
                </span>
                {pair.result?.duration_ms != null && (
                  <span className="text-xs text-kage-sub/60 flex items-center gap-0.5">
                    <Clock size={10} />
                    {pair.result.duration_ms < 1000
                      ? `${pair.result.duration_ms}ms`
                      : `${(pair.result.duration_ms / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
              <JsonViewer
                data={{ args: pair.call.args }}
                maxLines={4}
                label="Args"
              />
              {pair.result && (
                <div className={`mt-1 text-xs px-2 py-1 rounded ${
                  pair.result.success === false
                    ? 'bg-red-500/10 text-red-300'
                    : 'bg-green-500/10 text-green-300'
                }`}>
                  <span className="font-medium">{pair.result.success === false ? 'Error: ' : 'Result: '}</span>
                  <span className="break-all">{(pair.result.result || '').slice(0, 200)}</span>
                </div>
              )}
            </div>
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
