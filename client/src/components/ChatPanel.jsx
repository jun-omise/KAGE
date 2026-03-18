import React, { useRef, useEffect, useCallback } from 'react';
import { Loader2, MessageSquare, Wrench, CheckCircle, Shield, Brain, Zap, ClipboardCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useI18n } from '../i18n/index.jsx';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ProgressIndicator from './ProgressIndicator';

const AGENT_ICONS = {
  sentinel: Shield,
  planner: Brain,
  executor: Zap,
  reviewer: ClipboardCheck,
};

const AGENT_COLORS = {
  sentinel: 'text-yellow-400',
  planner: 'text-purple-400',
  executor: 'text-blue-400',
  reviewer: 'text-green-400',
};

function LiveToolCall({ agentStates }) {
  if (!agentStates) return null;

  // Find the currently active agent and its latest tool call
  const activeAgents = Object.entries(agentStates)
    .filter(([_, state]) => state.status === 'active' || state.status === 'running');

  if (activeAgents.length === 0) return null;

  return (
    <div className="space-y-1 mb-2">
      {activeAgents.map(([name, state]) => {
        const Icon = AGENT_ICONS[name] || Wrench;
        const color = AGENT_COLORS[name] || 'text-kage-sub';
        const lastLog = state.logs?.[state.logs.length - 1];
        const isToolCall = lastLog?.type === 'tool_call';

        return (
          <div key={name} className="flex items-center gap-2 text-xs">
            <Icon size={13} className={`${color} animate-pulse`} />
            <span className={`font-medium ${color} capitalize`}>{name}</span>
            {isToolCall && (
              <span className="text-kage-sub font-mono truncate">
                {lastLog.tool}
              </span>
            )}
            {lastLog?.type === 'thinking' && (
              <span className="text-kage-sub truncate italic">
                {typeof lastLog.message === 'string' ? lastLog.message.slice(0, 60) : 'thinking...'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ChatPanel({
  messages, isLoading, onSendMessage,
  pipelineProgress, subtaskProgress, streamingText,
  agentStates,
}) {
  const { t } = useI18n();
  const messagesEndRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  return (
    <div className="flex flex-col h-full bg-kage-bg">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-kage-primary/10 flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-kage-primary" />
            </div>
            <h3 className="text-lg font-medium text-kage-text mb-1">{t('chat.noMessages')}</h3>
            <p className="text-sm text-kage-sub max-w-sm">
              {t('app.tagline')}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Streaming response display */}
            {isLoading && streamingText && (
              <div className="flex justify-start animate-slide-up">
                <div className="bg-kage-card border border-kage-border/50 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] text-kage-text">
                  <LiveToolCall agentStates={agentStates} />
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {streamingText}
                  </ReactMarkdown>
                  <span className="inline-block w-1.5 h-4 bg-kage-primary animate-pulse ml-0.5 align-text-bottom" />
                </div>
              </div>
            )}

            {/* Loading indicator (before streaming starts) */}
            {isLoading && !streamingText && (
              <div className="flex justify-start animate-slide-up">
                <div className="bg-kage-card border border-kage-border/50 rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%] w-full">
                  {pipelineProgress ? (
                    <ProgressIndicator
                      pipelineProgress={pipelineProgress}
                      subtaskProgress={subtaskProgress}
                      agentStates={agentStates}
                      compact
                    />
                  ) : (
                    <div className="flex items-center gap-2 text-kage-sub text-sm">
                      <Loader2 size={16} className="animate-spin" />
                      {t('chat.thinking')}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <MessageInput isLoading={isLoading} onSendMessage={onSendMessage} />
    </div>
  );
}
