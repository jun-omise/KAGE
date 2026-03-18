import React, { useState, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, DollarSign, Bookmark,
  Shield, Brain, Zap, ClipboardCheck, Search, Wrench,
  FileText, Loader2, CheckCircle, XCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '../i18n/index.jsx';
import ResultPresenter from './ResultPresenter';

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-xl font-bold mt-3 mb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed mb-1">{children}</p>,
  ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  code: ({ inline, className, children }) => {
    if (inline) {
      return (
        <code className="bg-kage-bg px-1.5 py-0.5 rounded text-kage-primary text-xs font-mono">
          {children}
        </code>
      );
    }
    return (
      <pre className="bg-[#1a1b26] rounded-lg p-3 my-2 overflow-x-auto text-sm border border-kage-border/30">
        <code className="text-kage-text font-mono">{children}</code>
      </pre>
    );
  },
  pre: ({ children }) => <>{children}</>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-kage-primary hover:underline">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full text-sm border border-kage-border">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-kage-border px-2 py-1 bg-kage-bg font-medium text-left">{children}</th>,
  td: ({ children }) => <td className="border border-kage-border px-2 py-1">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-kage-primary pl-3 my-2 text-kage-sub italic">{children}</blockquote>
  ),
  hr: () => <hr className="border-kage-border my-3" />,
};

function MarkdownContent({ content }) {
  if (!content) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

const AGENT_ICONS = {
  sentinel: Shield,
  planner: Brain,
  executor: Zap,
  reviewer: ClipboardCheck,
  researcher: Search,
};

const AGENT_COLORS = {
  sentinel: 'text-yellow-400',
  planner: 'text-purple-400',
  executor: 'text-blue-400',
  reviewer: 'text-green-400',
  researcher: 'text-cyan-400',
};

function ToolCallBlock({ log }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = log.tool || 'unknown';
  const args = log.args;

  // Truncate preview of args
  const preview = useMemo(() => {
    if (!args) return '';
    if (typeof args === 'string') return args.slice(0, 80);
    const str = JSON.stringify(args);
    return str.length > 100 ? str.slice(0, 100) + '...' : str;
  }, [args]);

  return (
    <div className="rounded border border-kage-border/30 bg-[#1a1b26] overflow-hidden my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/5 transition-colors"
      >
        <Wrench size={12} className="text-kage-primary flex-shrink-0" />
        <span className="text-xs font-mono text-kage-text truncate flex-1">{toolName}</span>
        {expanded ? <ChevronDown size={12} className="text-kage-sub" /> : <ChevronRight size={12} className="text-kage-sub" />}
      </button>
      {expanded && args && (
        <div className="px-2.5 pb-2 border-t border-kage-border/20">
          <pre className="text-[11px] text-kage-sub font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto mt-1.5">
            {typeof args === 'string' ? args : JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolResultBlock({ log }) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = log.success !== false;

  return (
    <div className="rounded border border-kage-border/30 bg-[#1a1b26] overflow-hidden my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/5 transition-colors"
      >
        {isSuccess
          ? <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
          : <XCircle size={12} className="text-red-400 flex-shrink-0" />
        }
        <span className="text-xs font-mono text-kage-sub truncate flex-1">
          {log.tool || 'result'} {log.duration_ms ? `(${(log.duration_ms / 1000).toFixed(1)}s)` : ''}
        </span>
        {expanded ? <ChevronDown size={12} className="text-kage-sub" /> : <ChevronRight size={12} className="text-kage-sub" />}
      </button>
      {expanded && log.result && (
        <div className="px-2.5 pb-2 border-t border-kage-border/20">
          <pre className="text-[11px] text-kage-sub font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto mt-1.5">
            {typeof log.result === 'string' ? log.result : JSON.stringify(log.result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function AgentTraceInline({ agentTrace }) {
  const [expanded, setExpanded] = useState(false);

  if (!agentTrace) return null;

  // agentTrace can be either { agents: [...] } or an array of trace entries
  const traceEntries = Array.isArray(agentTrace) ? agentTrace : agentTrace.agents || [];
  if (traceEntries.length === 0) return null;

  return (
    <div className="mt-2 border-t border-kage-border/20 pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-kage-sub hover:text-kage-text transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="font-medium">Agent Pipeline</span>
        <span className="text-kage-sub/60">({traceEntries.length} steps)</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 pl-1">
          {traceEntries.map((entry, i) => {
            const agentName = entry.agent || entry.name || 'unknown';
            const AgentIcon = AGENT_ICONS[agentName] || Wrench;
            const agentColor = AGENT_COLORS[agentName] || 'text-kage-sub';
            const logs = entry.logs || [];

            return (
              <AgentTraceEntry
                key={i}
                agent={agentName}
                Icon={AgentIcon}
                color={agentColor}
                entry={entry}
                logs={logs}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentTraceEntry({ agent, Icon, color, entry, logs }) {
  const [showLogs, setShowLogs] = useState(false);
  const hasLogs = logs.length > 0;
  const toolCalls = logs.filter(l => l.type === 'tool_call');
  const toolResults = logs.filter(l => l.type === 'tool_result');

  return (
    <div className="rounded border border-kage-border/20 bg-kage-bg/30 overflow-hidden">
      <button
        onClick={() => hasLogs && setShowLogs(!showLogs)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-white/3 transition-colors"
      >
        <Icon size={13} className={color} />
        <span className={`text-xs font-medium ${color} capitalize`}>{agent}</span>
        {entry.action && <span className="text-[11px] text-kage-sub truncate flex-1">{entry.action}</span>}
        {entry.duration_ms && (
          <span className="text-[10px] text-kage-sub/60">{(entry.duration_ms / 1000).toFixed(1)}s</span>
        )}
        {hasLogs && (showLogs ? <ChevronDown size={11} className="text-kage-sub" /> : <ChevronRight size={11} className="text-kage-sub" />)}
      </button>
      {showLogs && (
        <div className="px-2.5 pb-2 space-y-0.5">
          {logs.map((log, j) => {
            if (log.type === 'tool_call') return <ToolCallBlock key={j} log={log} />;
            if (log.type === 'tool_result') return <ToolResultBlock key={j} log={log} />;
            return null;
          })}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, onSaveAsTemplate }) {
  const { t } = useI18n();
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-kage-primary text-white rounded-br-md'
            : 'bg-kage-card border border-kage-border/50 text-kage-text rounded-bl-md'
        }`}
      >
        <MarkdownContent content={message.content} />

        {/* Save as Template button (user messages only) */}
        {isUser && onSaveAsTemplate && (
          <button
            onClick={() => onSaveAsTemplate(message.content)}
            className="flex items-center gap-1 mt-2 text-xs text-white/50 hover:text-white/80 transition-colors"
            title={t('templates.saveAs') || 'Save as template'}
          >
            <Bookmark size={12} />
            <span>{t('templates.saveAs') || 'Template'}</span>
          </button>
        )}

        {/* Cost display */}
        {message.cost > 0 && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${isUser ? 'text-white/60' : 'text-kage-sub'}`}>
            <DollarSign size={12} />
            <span>${typeof message.cost === 'number' ? message.cost.toFixed(4) : message.cost}</span>
          </div>
        )}

        {/* File results - code block style */}
        {!isUser && message.fileResults && message.fileResults.length > 0 && (
          <ResultPresenter fileResults={message.fileResults} />
        )}

        {/* Agent trace - inline collapsible */}
        {!isUser && message.agentTrace && (
          <AgentTraceInline agentTrace={message.agentTrace} />
        )}
      </div>
    </div>
  );
}
