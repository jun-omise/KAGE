import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import MCPSuggestionBanner from './MCPSuggestionBanner';
import { useMCPSuggestions } from '../hooks/useMCPSuggestions';

export default function MessageInput({ isLoading, onSendMessage }) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const { suggestions, connectServer, dismiss } = useMCPSuggestions(input);

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
    <div className="border-t border-kage-border px-4 py-3">
      <div className="max-w-3xl mx-auto">
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
  );
}
