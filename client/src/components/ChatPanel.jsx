import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Loader2, MessageSquare } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import MessageBubble from './MessageBubble';
import ProgressIndicator from './ProgressIndicator';
import MCPSuggestionBanner from './MCPSuggestionBanner';
import { useMCPSuggestions } from '../hooks/useMCPSuggestions';

export default function ChatPanel({ messages, isLoading, onSendMessage, pipelineProgress, subtaskProgress }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const { suggestions, connectServer, dismiss } = useMCPSuggestions(input);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="flex flex-col h-full bg-kage-bg">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
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

            {isLoading && (
              <div className="flex justify-start animate-slide-up">
                <div className="bg-kage-card border border-kage-border rounded-2xl rounded-bl-md px-4 py-3 max-w-[80%] w-full">
                  {pipelineProgress ? (
                    <ProgressIndicator
                      pipelineProgress={pipelineProgress}
                      subtaskProgress={subtaskProgress}
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
      <div className="border-t border-kage-border px-4 py-3">
        <div className="max-w-3xl mx-auto">
          {/* MCP Suggestion Banner */}
          <MCPSuggestionBanner
            suggestions={suggestions}
            onConnect={connectServer}
            onDismiss={dismiss}
          />

          <div className="flex items-end gap-2 bg-kage-card border border-kage-border rounded-xl px-3 py-2">
            <button
              onClick={handleFileClick}
              className="p-1.5 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors flex-shrink-0 mb-0.5"
              title="Attach file"
            >
              <Paperclip size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-kage-text placeholder-kage-sub text-sm py-1.5 max-h-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-1.5 rounded-lg flex-shrink-0 mb-0.5 transition-all duration-200 ${
                input.trim() && !isLoading
                  ? 'bg-kage-primary text-white hover:bg-kage-primary/80'
                  : 'text-kage-sub/40 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
