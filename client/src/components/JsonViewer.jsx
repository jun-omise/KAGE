import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export default function JsonViewer({ data, maxLines = 10, label }) {
  const [expanded, setExpanded] = useState(false);

  if (data === null || data === undefined) return null;

  let jsonStr;
  try {
    jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  } catch {
    jsonStr = String(data);
  }

  const lines = jsonStr.split('\n');
  const isLong = lines.length > maxLines;
  const displayLines = expanded ? lines : lines.slice(0, maxLines);

  // Simple syntax highlighting
  const highlightLine = (line) => {
    return line
      .replace(/"([^"]+)":/g, '<span class="text-kage-primary">"$1"</span>:')
      .replace(/: "([^"]*)"/g, ': <span class="text-green-400">"$1"</span>')
      .replace(/: (\d+\.?\d*)/g, ': <span class="text-yellow-400">$1</span>')
      .replace(/: (true|false)/g, ': <span class="text-blue-400">$1</span>')
      .replace(/: (null)/g, ': <span class="text-gray-500">$1</span>');
  };

  return (
    <div className="bg-kage-bg rounded-lg overflow-hidden text-xs">
      {label && (
        <div className="px-2 py-1 bg-kage-border/30 text-kage-sub font-medium">{label}</div>
      )}
      <pre className="px-2 py-1.5 overflow-x-auto font-mono leading-relaxed">
        {displayLines.map((line, i) => (
          <div
            key={i}
            className="text-kage-text"
            dangerouslySetInnerHTML={{ __html: highlightLine(line) }}
          />
        ))}
      </pre>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-kage-primary hover:text-kage-primary/80 w-full bg-kage-border/20"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {expanded ? 'Show less' : `Show ${lines.length - maxLines} more lines`}
        </button>
      )}
    </div>
  );
}
