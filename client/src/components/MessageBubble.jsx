import React, { useState } from 'react';
import { ChevronDown, ChevronRight, DollarSign } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import ResultPresenter from './ResultPresenter';

function SimpleMarkdown({ content }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-kage-bg rounded-lg p-3 my-2 overflow-x-auto text-sm">
            <code className="text-kage-text">{codeLines.join('\n')}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-base font-semibold mt-3 mb-1">{formatInline(line.slice(4))}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-lg font-semibold mt-3 mb-1">{formatInline(line.slice(3))}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-xl font-bold mt-3 mb-1">{formatInline(line.slice(2))}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <li key={i} className="ml-4 list-disc text-sm leading-relaxed">{formatInline(line.slice(2))}</li>
      );
    } else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, '');
      elements.push(
        <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">{formatInline(text)}</li>
      );
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm leading-relaxed">{formatInline(line)}</p>);
    }
  }

  return <div className="space-y-0.5">{elements}</div>;
}

function formatInline(text) {
  const parts = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    const codeMatch = remaining.match(/`([^`]+)`/);

    let firstMatch = null;
    let firstIndex = remaining.length;

    if (boldMatch && boldMatch.index < firstIndex) {
      firstMatch = { type: 'bold', match: boldMatch };
      firstIndex = boldMatch.index;
    }
    if (codeMatch && codeMatch.index < firstIndex) {
      firstMatch = { type: 'code', match: codeMatch };
      firstIndex = codeMatch.index;
    }

    if (!firstMatch) {
      parts.push(remaining);
      break;
    }

    if (firstIndex > 0) {
      parts.push(remaining.slice(0, firstIndex));
    }

    if (firstMatch.type === 'bold') {
      parts.push(<strong key={key++} className="font-semibold">{firstMatch.match[1]}</strong>);
      remaining = remaining.slice(firstIndex + firstMatch.match[0].length);
    } else if (firstMatch.type === 'code') {
      parts.push(
        <code key={key++} className="bg-kage-bg px-1.5 py-0.5 rounded text-kage-primary text-xs font-mono">
          {firstMatch.match[1]}
        </code>
      );
      remaining = remaining.slice(firstIndex + firstMatch.match[0].length);
    }
  }

  return parts;
}

export default function MessageBubble({ message }) {
  const { t } = useI18n();
  const [showTrace, setShowTrace] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-kage-primary text-white rounded-br-md'
            : 'bg-kage-card border border-kage-border text-kage-text rounded-bl-md'
        }`}
      >
        <SimpleMarkdown content={message.content} />

        {/* Cost display */}
        {message.cost && (
          <div className={`flex items-center gap-1 mt-2 text-xs ${isUser ? 'text-white/60' : 'text-kage-sub'}`}>
            <DollarSign size={12} />
            <span>${typeof message.cost === 'number' ? message.cost.toFixed(4) : message.cost}</span>
          </div>
        )}

        {/* File results */}
        {!isUser && message.fileResults && message.fileResults.length > 0 && (
          <ResultPresenter fileResults={message.fileResults} />
        )}

        {/* Agent trace toggle */}
        {message.agentTrace && (
          <div className="mt-2 border-t border-white/10 pt-2">
            <button
              onClick={() => setShowTrace(!showTrace)}
              className={`flex items-center gap-1 text-xs ${isUser ? 'text-white/60 hover:text-white/80' : 'text-kage-sub hover:text-kage-text'} transition-colors`}
            >
              {showTrace ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Agent Trace
            </button>
            {showTrace && (
              <div className={`mt-1.5 text-xs space-y-1 ${isUser ? 'text-white/50' : 'text-kage-sub'}`}>
                {message.agentTrace.agents && message.agentTrace.agents.map((agent, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="font-medium">{agent.name}:</span>
                    <span>{agent.action}</span>
                  </div>
                ))}
                {message.agentTrace.elapsed && (
                  <div>{t('agents.elapsed')}: {message.agentTrace.elapsed}s</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
