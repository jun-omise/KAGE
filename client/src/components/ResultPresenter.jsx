import React, { useState } from 'react';
import {
  FileText, FileSpreadsheet, Presentation, FileCode, File,
  ExternalLink, FolderOpen,
} from 'lucide-react';
import { api } from '../api.js';

const FILE_ICONS = {
  pptx: Presentation,
  ppt: Presentation,
  xlsx: FileSpreadsheet,
  xls: FileSpreadsheet,
  csv: FileSpreadsheet,
  docx: FileText,
  doc: FileText,
  pdf: FileText,
  svg: FileCode,
  html: FileCode,
  js: FileCode,
  jsx: FileCode,
  ts: FileCode,
  tsx: FileCode,
  py: FileCode,
  json: FileCode,
};

const FILE_COLORS = {
  pptx: 'text-orange-400',
  ppt: 'text-orange-400',
  xlsx: 'text-green-400',
  xls: 'text-green-400',
  csv: 'text-green-400',
  docx: 'text-blue-400',
  doc: 'text-blue-400',
  pdf: 'text-red-400',
  svg: 'text-yellow-400',
  html: 'text-purple-400',
};

const ACTION_LABELS = {
  created: 'Created',
  modified: 'Modified',
  read: 'Read',
};

function getExt(path) {
  return path?.split('.').pop()?.toLowerCase() || '';
}

function getFileName(path) {
  return path?.split('/').pop() || path;
}

function getFileDir(path) {
  const parts = path?.split('/') || [];
  parts.pop();
  const dir = parts.join('/') || '/';
  return dir.replace(/^\/Users\/[^/]+/, '~');
}

export default function ResultPresenter({ fileResults }) {
  if (!fileResults || fileResults.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {fileResults.map((fr, i) => (
        <FileResultBlock key={i} file={fr} />
      ))}
    </div>
  );
}

function FileResultBlock({ file }) {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState(null);
  const ext = getExt(file.path);
  const Icon = FILE_ICONS[ext] || File;
  const color = FILE_COLORS[ext] || 'text-kage-sub';
  const fileName = getFileName(file.path);
  const fileDir = getFileDir(file.path);

  const handleOpen = async () => {
    setOpening(true);
    setError(null);
    try {
      await api.post('/files/open', { path: file.path });
    } catch (err) {
      console.error('Failed to open file:', err);
      setError('Failed to open');
    } finally {
      setOpening(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await api.post('/files/open-folder', { path: file.path });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  return (
    <div className="rounded-lg border border-kage-border/50 bg-[#1a1b26] overflow-hidden">
      {/* File header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#16171f] border-b border-kage-border/30">
        <Icon size={14} className={color} />
        <span className="text-xs font-mono text-kage-text font-medium flex-1 truncate">
          {fileName}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          file.action === 'created' ? 'bg-green-500/10 text-green-400'
          : file.action === 'modified' ? 'bg-yellow-500/10 text-yellow-400'
          : 'bg-blue-500/10 text-blue-400'
        }`}>
          {ACTION_LABELS[file.action] || file.action}
        </span>
      </div>
      {/* File path + actions */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-[11px] text-kage-sub font-mono truncate flex-1">{fileDir}</span>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-kage-sub hover:text-kage-text hover:bg-white/5 transition-colors"
          title="Show in Finder"
        >
          <FolderOpen size={12} />
          <span className="hidden sm:inline">Folder</span>
        </button>
        <button
          onClick={handleOpen}
          disabled={opening}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-kage-primary/15 text-kage-primary hover:bg-kage-primary/25 transition-colors disabled:opacity-50"
          title="Open with default app"
        >
          <ExternalLink size={13} />
          {opening ? 'Opening...' : 'Open File'}
        </button>
      </div>
      {error && (
        <div className="px-3 pb-2 text-[11px] text-red-400">{error}</div>
      )}
    </div>
  );
}
