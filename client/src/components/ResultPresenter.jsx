import React from 'react';
import { FileText, FolderOpen, ExternalLink, Code } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const ACTION_BADGES = {
  created: { text: 'Created', class: 'bg-kage-success/10 text-kage-success' },
  modified: { text: 'Modified', class: 'bg-kage-warning/10 text-kage-warning' },
  read: { text: 'Read', class: 'bg-kage-primary/10 text-kage-primary' },
};

function getFileIcon(path) {
  if (!path) return FileText;
  const ext = path.split('.').pop()?.toLowerCase();
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'go', 'rs', 'java'].includes(ext)) return Code;
  return FileText;
}

function getFileName(path) {
  return path?.split('/').pop() || path;
}

function getFileDir(path) {
  const parts = path?.split('/') || [];
  parts.pop();
  return parts.join('/') || '/';
}

export default function ResultPresenter({ fileResults }) {
  const { t } = useI18n();

  if (!fileResults || fileResults.length === 0) return null;

  const handleOpenFile = async (path, app = 'finder') => {
    try {
      await fetch('/api/files/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, app }),
      });
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  };

  const handleOpenFolder = async (path) => {
    try {
      await fetch('/api/files/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="text-xs font-medium text-kage-sub mb-1">
        {t('results.filesCreated')}
      </div>
      {fileResults.map((fr, i) => {
        const Icon = getFileIcon(fr.path);
        const badge = ACTION_BADGES[fr.action] || ACTION_BADGES.read;

        return (
          <div
            key={i}
            className="flex items-center gap-2 bg-kage-bg rounded-lg px-3 py-2 group"
          >
            <Icon size={16} className="text-kage-sub flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-kage-text font-medium truncate">
                  {getFileName(fr.path)}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.class}`}>
                  {badge.text}
                </span>
              </div>
              <p className="text-xs text-kage-sub truncate">{getFileDir(fr.path)}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleOpenFile(fr.path, 'finder')}
                className="p-1 rounded hover:bg-white/10 text-kage-sub hover:text-kage-text transition-colors"
                title={t('results.openFinder')}
              >
                <FolderOpen size={14} />
              </button>
              <button
                onClick={() => handleOpenFile(fr.path, 'vscode')}
                className="p-1 rounded hover:bg-white/10 text-kage-sub hover:text-kage-text transition-colors"
                title={t('results.openVSCode')}
              >
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
