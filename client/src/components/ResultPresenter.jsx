import React, { useState } from 'react';
import {
  FileText, FileSpreadsheet, Presentation, FileCode, File,
  ExternalLink, FolderOpen, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

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
  // Shorten home directory
  return dir.replace(/^\/Users\/[^/]+/, '~');
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function ResultPresenter({ fileResults }) {
  const { t } = useI18n();

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
  const ext = getExt(file.path);
  const Icon = FILE_ICONS[ext] || File;
  const color = FILE_COLORS[ext] || 'text-kage-sub';
  const fileName = getFileName(file.path);
  const fileDir = getFileDir(file.path);

  const handleOpen = async () => {
    try {
      await fetch('/api/files/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path, app: 'default' }),
      });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await fetch('/api/files/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path }),
      });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  return (
    <div className="rounded-lg border border-kage-border/50 bg-[#1a1b26] overflow-hidden group">
      {/* File header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#16171f] border-b border-kage-border/30">
        <Icon size={14} className={color} />
        <span className="text-xs font-mono text-kage-text font-medium flex-1 truncate">
          {fileName}
        </span>
        <span className="text-[10px] text-kage-sub font-mono">{fileDir}</span>
      </div>
      {/* File info / action row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
          file.action === 'created' ? 'bg-green-500/10 text-green-400'
          : file.action === 'modified' ? 'bg-yellow-500/10 text-yellow-400'
          : 'bg-blue-500/10 text-blue-400'
        }`}>
          {ACTION_LABELS[file.action] || file.action}
        </span>
        {file.size && (
          <span className="text-[10px] text-kage-sub">{formatFileSize(file.size)}</span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleOpen}
          className="flex items-center gap-1 text-[11px] text-kage-primary hover:text-kage-primary/80 transition-colors opacity-0 group-hover:opacity-100"
          title="Open with default app"
        >
          <ExternalLink size={12} />
          Open
        </button>
        <button
          onClick={handleOpenFolder}
          className="flex items-center gap-1 text-[11px] text-kage-sub hover:text-kage-text transition-colors opacity-0 group-hover:opacity-100"
          title="Show in Finder"
        >
          <FolderOpen size={12} />
        </button>
      </div>
    </div>
  );
}
