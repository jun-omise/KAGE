/**
 * Settings page — unified settings with 6 sections.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon, Bell, MessageCircle, Brain,
  Database, Globe, Trash2, Download, Loader2,
  HardDrive, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle, XCircle,
} from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import ModelSelector from '../components/ModelSelector.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import MessagingConfig from '../components/MessagingConfig.jsx';

const TABS = [
  { key: 'model', icon: Brain, label: 'Model' },
  { key: 'memory', icon: Database, label: 'Memory' },
  { key: 'channels', icon: Globe, label: 'Channels' },
  { key: 'notifications', icon: Bell, label: 'Notifications' },
  { key: 'messaging', icon: MessageCircle, label: 'Messaging' },
  { key: 'data', icon: HardDrive, label: 'Data' },
];

function MemorySection() {
  const [memories, setMemories] = useState([]);
  const [stats, setStats] = useState({ total: 0, categories: {} });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        const mems = Array.isArray(data) ? data : data.memories || [];
        setMemories(mems);
        const cats = {};
        mems.forEach(m => { cats[m.category] = (cats[m.category] || 0) + 1; });
        setStats({ total: mems.length, categories: cats });
      }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchMemories(); }, [fetchMemories]);

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/memory/${id}`, { method: 'DELETE' });
      fetchMemories();
    } catch { /* */ }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete all memories? This cannot be undone.')) return;
    for (const m of memories) {
      await fetch(`/api/memory/${m.id}`, { method: 'DELETE' });
    }
    fetchMemories();
  };

  const CATEGORY_COLORS = {
    fact: 'bg-blue-500/10 text-blue-400',
    preference: 'bg-purple-500/10 text-purple-400',
    context: 'bg-green-500/10 text-green-400',
    task: 'bg-yellow-500/10 text-yellow-400',
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="kage-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-kage-text flex items-center gap-2">
            <Database size={16} className="text-kage-sub" /> Memory
          </h3>
          <span className="text-xs text-kage-sub">{stats.total} memories</span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(stats.categories).map(([cat, count]) => (
            <span key={cat} className={`text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[cat] || 'bg-kage-sub/10 text-kage-sub'}`}>
              {cat}: {count}
            </span>
          ))}
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="kage-btn-ghost text-xs border border-kage-border px-3 py-1.5 flex items-center gap-1.5"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'Show memories'}
          </button>
          <button
            onClick={handleDeleteAll}
            disabled={memories.length === 0}
            className="kage-btn-ghost text-xs border border-kage-danger/30 text-kage-danger px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-30"
          >
            <Trash2 size={12} /> Clear all
          </button>
        </div>

        {expanded && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-kage-primary" /></div>
            ) : memories.length === 0 ? (
              <p className="text-xs text-kage-sub text-center py-4">No memories stored yet.</p>
            ) : (
              memories.map(m => (
                <div key={m.id} className="flex items-start gap-2 bg-kage-bg rounded-lg px-3 py-2 group">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${CATEGORY_COLORS[m.category] || ''}`}>
                    {m.category}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-kage-text truncate">{m.content}</p>
                    <p className="text-[10px] text-kage-sub">importance: {m.importance}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-kage-sub hover:text-kage-danger opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelsSection() {
  const channels = [
    { name: 'WebChat', icon: '🌐', enabled: true },
    { name: 'Telegram', icon: '📱', enabled: false },
    { name: 'LINE', icon: '💬', enabled: false },
    { name: 'Slack', icon: '📨', enabled: false },
  ];

  return (
    <div className="space-y-4 fade-in">
      <div className="kage-card p-5">
        <h3 className="text-sm font-semibold text-kage-text flex items-center gap-2 mb-4">
          <Globe size={16} className="text-kage-sub" /> Channels
        </h3>
        <div className="space-y-2">
          {channels.map(ch => (
            <div key={ch.name} className="flex items-center justify-between bg-kage-bg rounded-lg px-4 py-3 card-hover">
              <div className="flex items-center gap-3">
                <span className="text-lg">{ch.icon}</span>
                <div>
                  <span className="text-sm text-kage-text font-medium">{ch.name}</span>
                  {ch.enabled ? (
                    <span className="ml-2 badge-success text-[10px]">Connected</span>
                  ) : (
                    <span className="ml-2 text-[10px] text-kage-sub">Not configured</span>
                  )}
                </div>
              </div>
              {ch.enabled ? (
                <CheckCircle size={16} className="text-kage-success" />
              ) : (
                <span className="text-xs text-kage-sub">Coming soon</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DataSection() {
  const [exporting, setExporting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kage-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch { /* */ }
    setExporting(false);
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try { await fetch('/api/db/optimize', { method: 'POST' }); } catch { /* */ }
    setTimeout(() => setOptimizing(false), 1000);
  };

  return (
    <div className="space-y-4 fade-in">
      <div className="kage-card p-5">
        <h3 className="text-sm font-semibold text-kage-text flex items-center gap-2 mb-4">
          <HardDrive size={16} className="text-kage-sub" /> Data Management
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-kage-bg rounded-lg px-4 py-3">
            <div>
              <p className="text-sm text-kage-text">Export conversations</p>
              <p className="text-[10px] text-kage-sub">Download all conversations as JSON</p>
            </div>
            <button onClick={handleExport} disabled={exporting} className="kage-btn-ghost text-xs border border-kage-border px-3 py-1.5 flex items-center gap-1.5 btn-press">
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export
            </button>
          </div>
          <div className="flex items-center justify-between bg-kage-bg rounded-lg px-4 py-3">
            <div>
              <p className="text-sm text-kage-text">Optimize database</p>
              <p className="text-[10px] text-kage-sub">Run VACUUM to reclaim space</p>
            </div>
            <button onClick={handleOptimize} disabled={optimizing} className="kage-btn-ghost text-xs border border-kage-border px-3 py-1.5 flex items-center gap-1.5 btn-press">
              {optimizing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Optimize
            </button>
          </div>
          <div className="flex items-center justify-between bg-kage-bg rounded-lg px-4 py-3 border border-kage-danger/20">
            <div>
              <p className="text-sm text-kage-danger">Delete all data</p>
              <p className="text-[10px] text-kage-sub">Permanently removes all conversations, memories, and tasks</p>
            </div>
            <button className="kage-btn-danger text-xs px-3 py-1.5 flex items-center gap-1.5" onClick={() => alert('For safety, use the terminal: npm run db:reset')}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('model');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={20} className="text-kage-primary" />
          <h2 className="text-lg font-bold text-kage-text">Settings</h2>
        </div>

        <div className="flex gap-0.5 mb-6 border-b border-kage-border overflow-x-auto">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 btn-press ${
                activeTab === key
                  ? 'border-kage-primary text-kage-primary'
                  : 'border-transparent text-kage-sub hover:text-kage-text'
              }`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="fade-in">
          {activeTab === 'model' && <ModelSelector />}
          {activeTab === 'memory' && <MemorySection />}
          {activeTab === 'channels' && <ChannelsSection />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'messaging' && <MessagingConfig />}
          {activeTab === 'data' && <DataSection />}
        </div>
      </div>
    </div>
  );
}
