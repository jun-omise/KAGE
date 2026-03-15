import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench, Settings, Plus, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Loader2, CheckCircle, XCircle,
  Plug, Trash2, Play, Lock, Search,
} from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import MCPTestRunner from './MCPTestRunner';

const CATEGORY_META = {
  development: { icon: '💻', name: 'Development' },
  productivity: { icon: '📋', name: 'Productivity' },
  communication: { icon: '💬', name: 'Communication' },
  data: { icon: '🗄️', name: 'Data & Storage' },
  cloud: { icon: '☁️', name: 'Cloud & DevOps' },
  ai: { icon: '🤖', name: 'AI & ML' },
  search: { icon: '🔍', name: 'Search & Web' },
  finance: { icon: '💰', name: 'Finance' },
  design: { icon: '🎨', name: 'Design' },
  other: { icon: '📦', name: 'Other' },
};

export default function ToolManager() {
  const { t } = useI18n();
  const [tools, setTools] = useState([]);
  const [builtinServers, setBuiltinServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set(['development', 'productivity']));

  // Custom server form
  const [showAddServer, setShowAddServer] = useState(false);
  const [serverForm, setServerForm] = useState({ name: '', command: '', env: '' });
  const [addingServer, setAddingServer] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [connectingId, setConnectingId] = useState(null);

  // Permission policies
  const [policies, setPolicies] = useState({
    writeOps: 'confirm',
    externalApi: 'confirm',
    fileDeletion: 'confirm',
  });

  const fetchTools = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [toolsRes, builtinRes] = await Promise.all([
        fetch('/api/tools'),
        fetch('/api/tools/builtin'),
      ]);

      if (toolsRes.ok) {
        const data = await toolsRes.json();
        setTools(Array.isArray(data) ? data : data.tools || []);
      }

      if (builtinRes.ok) {
        const data = await builtinRes.json();
        setBuiltinServers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleConnect = useCallback(async (server) => {
    setConnectingId(server.id);
    setError('');
    try {
      const res = await fetch('/api/tools/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: server.name,
          type: 'mcp',
          config: {
            command: server.command,
            args: server.args || [],
            env: server.env || {},
          },
          permissions: server.permissions || [],
        }),
      });
      if (!res.ok) throw new Error('Failed to connect');
      setSuccess(`${server.name} connected!`);
      setTimeout(() => setSuccess(''), 3000);
      await fetchTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setConnectingId(null);
    }
  }, [fetchTools]);

  const handleTest = useCallback(async (id) => {
    setTestingId(id);
    setError('');
    try {
      const res = await fetch(`/api/tools/${id}/test`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        setSuccess(result.message || 'Test passed!');
      } else {
        setError(result.error || 'Test failed');
      }
      setTimeout(() => { setSuccess(''); setError(''); }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setTestingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/tools/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      await fetchTools();
    } catch (err) {
      setError(err.message);
    }
  }, [fetchTools]);

  const handleAddServer = useCallback(async () => {
    if (!serverForm.name.trim() || !serverForm.command.trim()) return;
    setAddingServer(true);
    try {
      const envVars = {};
      if (serverForm.env.trim()) {
        serverForm.env.split('\n').forEach((line) => {
          const eqIdx = line.indexOf('=');
          if (eqIdx > 0) envVars[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
        });
      }
      const cmdParts = serverForm.command.trim().split(/\s+/);
      const res = await fetch('/api/tools/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: serverForm.name,
          type: 'custom',
          config: {
            command: cmdParts[0],
            args: cmdParts.slice(1),
            env: envVars,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to add server');
      setServerForm({ name: '', command: '', env: '' });
      setShowAddServer(false);
      setSuccess('Server added!');
      setTimeout(() => setSuccess(''), 3000);
      await fetchTools();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingServer(false);
    }
  }, [serverForm, fetchTools]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(catId) ? next.delete(catId) : next.add(catId);
      return next;
    });
  };

  // Group builtin servers by category
  const connectedNames = new Set(tools.map(t => t.name));
  const categorized = {};
  for (const server of builtinServers) {
    const cat = server.category || 'other';
    if (!categorized[cat]) categorized[cat] = [];
    categorized[cat].push({ ...server, isConnected: connectedNames.has(server.name) });
  }

  // Filter by search
  const filterServer = (s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-kage-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench size={20} className="text-kage-primary" />
            <h2 className="text-lg font-bold text-kage-text">{t('tools.title')}</h2>
            <span className="text-xs text-kage-sub bg-kage-card px-2 py-0.5 rounded-full">
              {builtinServers.length} integrations
            </span>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-kage-danger/10 border border-kage-danger/30 rounded-lg px-4 py-2 text-sm text-kage-danger flex items-center gap-2">
            <XCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div className="bg-kage-success/10 border border-kage-success/30 rounded-lg px-4 py-2 text-sm text-kage-success flex items-center gap-2">
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {/* Connected Tools */}
        {tools.length > 0 && (
          <div className="kage-card p-5">
            <h3 className="text-sm font-semibold text-kage-text mb-3 flex items-center gap-2">
              <Plug size={14} className="text-kage-success" />
              Connected ({tools.length})
            </h3>
            <div className="space-y-2">
              {tools.map((tool) => (
                <div key={tool.id} className="flex items-center justify-between bg-kage-bg rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-kage-primary/10 flex items-center justify-center flex-shrink-0">
                      <Wrench size={14} className="text-kage-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-kage-text truncate">{tool.name}</div>
                      <div className="text-[10px] text-kage-sub truncate">
                        {tool.status === 'connected' ? '● Connected' : tool.status === 'error' ? '● Error' : '○ Disconnected'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleTest(tool.id)}
                      disabled={testingId === tool.id}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors"
                      title="Test"
                    >
                      {testingId === tool.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => handleDelete(tool.id)}
                      className="p-1.5 rounded-lg hover:bg-kage-danger/10 text-kage-sub hover:text-kage-danger transition-colors"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-kage-sub" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="kage-input w-full pl-9"
            placeholder="Search integrations... (GitHub, Slack, PostgreSQL...)"
          />
        </div>

        {/* Available Integrations by Category */}
        {Object.entries(categorized).map(([catId, servers]) => {
          const meta = CATEGORY_META[catId] || { icon: '📦', name: catId };
          const filtered = servers.filter(filterServer);
          if (filtered.length === 0) return null;
          const isExpanded = expandedCategories.has(catId);

          return (
            <div key={catId} className="kage-card overflow-hidden">
              <button
                onClick={() => toggleCategory(catId)}
                className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{meta.icon}</span>
                  <span className="text-sm font-semibold text-kage-text">{meta.name}</span>
                  <span className="text-[10px] text-kage-sub bg-kage-bg px-1.5 py-0.5 rounded">
                    {filtered.length}
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-kage-sub" /> : <ChevronDown size={16} className="text-kage-sub" />}
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 space-y-1.5">
                  {filtered.map(server => (
                    <div key={server.id} className="flex items-center justify-between bg-kage-bg rounded-lg px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-kage-text truncate">{server.name}</div>
                        <div className="text-[10px] text-kage-sub truncate">{server.description}</div>
                        {server.envKeys?.length > 0 && (
                          <div className="text-[9px] text-kage-sub/60 mt-0.5 truncate">
                            Requires: {server.envKeys.join(', ')}
                          </div>
                        )}
                      </div>
                      {server.isConnected ? (
                        <span className="text-[10px] px-2 py-1 rounded-full bg-kage-success/20 text-kage-success flex-shrink-0">
                          Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnect(server)}
                          disabled={connectingId === server.id}
                          className="kage-btn-primary text-xs px-3 py-1 flex items-center gap-1 flex-shrink-0"
                        >
                          {connectingId === server.id ? <Loader2 size={12} className="animate-spin" /> : <Plug size={12} />}
                          Connect
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Custom MCP Server */}
        <div className="kage-card p-5">
          <button onClick={() => setShowAddServer(!showAddServer)} className="flex items-center justify-between w-full">
            <h3 className="text-sm font-semibold text-kage-text flex items-center gap-2">
              <Plus size={14} className="text-kage-primary" />
              Add Custom MCP Server
            </h3>
            {showAddServer ? <ChevronUp size={16} className="text-kage-sub" /> : <ChevronDown size={16} className="text-kage-sub" />}
          </button>

          {showAddServer && (
            <div className="mt-4 space-y-3 animate-slide-up">
              <div>
                <label className="block text-xs text-kage-sub mb-1">Name</label>
                <input type="text" value={serverForm.name} onChange={(e) => setServerForm(p => ({ ...p, name: e.target.value }))} className="kage-input w-full" placeholder="My MCP Server" />
                <p className="text-[10px] text-kage-sub mt-1">A friendly name for this server</p>
              </div>
              <div>
                <label className="block text-xs text-kage-sub mb-1">Command</label>
                <input type="text" value={serverForm.command} onChange={(e) => setServerForm(p => ({ ...p, command: e.target.value }))} className="kage-input w-full font-mono text-sm" placeholder="npx -y @my/mcp-server" />
                <p className="text-[10px] text-kage-sub mt-1">The command to start the MCP server (e.g., 'npx -y @modelcontextprotocol/server-filesystem')</p>
              </div>
              <div>
                <label className="block text-xs text-kage-sub mb-1">Environment Variables</label>
                <textarea value={serverForm.env} onChange={(e) => setServerForm(p => ({ ...p, env: e.target.value }))} className="kage-input w-full font-mono text-xs min-h-[60px] resize-y" placeholder={"API_KEY=your-key\nSECRET=your-secret"} rows={3} />
                <p className="text-[10px] text-kage-sub mt-1">One per line in KEY=VALUE format. These are passed to the server process.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleAddServer} disabled={addingServer || !serverForm.name.trim() || !serverForm.command.trim()} className="kage-btn-primary text-sm flex items-center gap-1.5 disabled:opacity-40">
                  {addingServer ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add Server
                </button>
              </div>
            </div>
          )}
        </div>

        {/* MCP Test Runner */}
        {tools.length > 0 && (
          <MCPTestRunner tools={tools} />
        )}

        {/* Permission Policy */}
        <div className="kage-card p-5">
          <h3 className="text-sm font-semibold text-kage-text mb-3 flex items-center gap-2">
            <Lock size={14} className="text-kage-sub" />
            Permission Policy
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { key: 'writeOps', label: 'Write', help: 'Controls file write and creation operations' },
              { key: 'externalApi', label: 'External API', help: 'Controls calls to external services and APIs' },
              { key: 'fileDeletion', label: 'Delete', help: 'Controls file and data deletion operations' },
            ].map((item) => (
              <div key={item.key}>
                <label className="block text-xs text-kage-sub mb-1">{item.label}</label>
                <select value={policies[item.key]} onChange={(e) => setPolicies(p => ({ ...p, [item.key]: e.target.value }))} className="kage-input w-full">
                  <option value="auto">Auto Approve</option>
                  <option value="confirm">Always Confirm</option>
                  <option value="first">First Time Confirm</option>
                </select>
                <p className="text-[10px] text-kage-sub mt-1">{item.help}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
