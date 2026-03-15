import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, TestTube, Check, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const CHANNEL_TYPES = [
  { type: 'webhook', name: 'Webhook', icon: '\uD83D\uDD17' },
  { type: 'line', name: 'LINE', icon: '\uD83D\uDFE2' },
  { type: 'whatsapp', name: 'WhatsApp', icon: '\uD83D\uDCAC' },
  { type: 'messenger', name: 'FB Messenger', icon: '\uD83D\uDCAD' },
];

const EVENT_TYPES = ['task_start', 'task_complete', 'task_error', 'approval_required', 'cost_warning', 'security_alert'];

const CONFIG_FIELDS = {
  webhook: [{ key: 'url', label: 'Webhook URL', type: 'url', placeholder: 'https://hooks.example.com/...' }],
  line: [{ key: 'token', label: 'LINE Notify Token', type: 'password', placeholder: 'Your LINE Notify token' }],
  whatsapp: [
    { key: 'accountSid', label: 'Account SID', type: 'text', placeholder: 'ACxxxxxx' },
    { key: 'authToken', label: 'Auth Token', type: 'password', placeholder: 'Your Twilio auth token' },
    { key: 'fromNumber', label: 'From Number', type: 'tel', placeholder: '+1234567890' },
    { key: 'toNumber', label: 'To Number', type: 'tel', placeholder: '+1234567890' },
  ],
  messenger: [
    { key: 'pageAccessToken', label: 'Page Access Token', type: 'password', placeholder: 'Your page access token' },
    { key: 'recipientId', label: 'Recipient ID', type: 'text', placeholder: 'Facebook user ID' },
  ],
};

export default function NotificationSettings() {
  const { t } = useI18n();
  const [channels, setChannels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChannel, setNewChannel] = useState({ type: 'webhook', name: '', config: {}, event_filters: [] });
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
      }
    } catch (err) {
      console.error('Load channels error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const handleCreate = async () => {
    if (!newChannel.name || !newChannel.type) return;
    try {
      const res = await fetch('/api/notifications/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newChannel),
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewChannel({ type: 'webhook', name: '', config: {}, event_filters: [] });
        loadChannels();
      }
    } catch (err) {
      console.error('Create channel error:', err);
    }
  };

  const handleToggle = async (id, enabled) => {
    try {
      await fetch(`/api/notifications/channels/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      loadChannels();
    } catch (err) {
      console.error('Toggle channel error:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/notifications/channels/${id}`, { method: 'DELETE' });
      loadChannels();
    } catch (err) {
      console.error('Delete channel error:', err);
    }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/notifications/channels/${id}/test`, { method: 'POST' });
      const data = await res.json();
      setTestResult({ id, success: res.ok, message: data.message || data.error });
    } catch (err) {
      setTestResult({ id, success: false, message: err.message });
    } finally {
      setTestingId(null);
    }
  };

  const getChannelIcon = (type) => CHANNEL_TYPES.find(ct => ct.type === type)?.icon || '\uD83D\uDD14';

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={22} className="text-kage-primary" />
            <h2 className="text-lg font-semibold text-kage-text">{t('notifications.title')}</h2>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="kage-btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus size={14} />
            {t('notifications.addChannel')}
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="kage-card p-4 space-y-4 animate-slide-up">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-kage-sub block mb-1">Type</label>
                <select
                  value={newChannel.type}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, type: e.target.value, config: {} }))}
                  className="kage-input w-full"
                >
                  {CHANNEL_TYPES.map(ct => (
                    <option key={ct.type} value={ct.type}>{ct.icon} {ct.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-kage-sub block mb-1">Name</label>
                <input
                  value={newChannel.name}
                  onChange={(e) => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                  className="kage-input w-full"
                  placeholder="My notification channel"
                />
              </div>
            </div>

            {/* Config fields based on type */}
            {CONFIG_FIELDS[newChannel.type]?.map(field => (
              <div key={field.key}>
                <label className="text-xs text-kage-sub block mb-1">{field.label}</label>
                <input
                  type={field.type}
                  value={newChannel.config[field.key] || ''}
                  onChange={(e) => setNewChannel(prev => ({
                    ...prev,
                    config: { ...prev.config, [field.key]: e.target.value },
                  }))}
                  className="kage-input w-full"
                  placeholder={field.placeholder}
                />
              </div>
            ))}

            {/* Event filters */}
            <div>
              <label className="text-xs text-kage-sub block mb-1">{t('notifications.events')}</label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map(evt => (
                  <label key={evt} className="flex items-center gap-1.5 text-xs text-kage-text">
                    <input
                      type="checkbox"
                      checked={newChannel.event_filters.includes(evt)}
                      onChange={(e) => {
                        setNewChannel(prev => ({
                          ...prev,
                          event_filters: e.target.checked
                            ? [...prev.event_filters, evt]
                            : prev.event_filters.filter(f => f !== evt),
                        }));
                      }}
                      className="rounded border-kage-border"
                    />
                    {t(`notifications.${evt.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`) || evt}
                  </label>
                ))}
              </div>
              <p className="text-xs text-kage-sub mt-1">Leave empty to receive all events</p>
            </div>

            <div className="flex gap-2">
              <button onClick={handleCreate} className="kage-btn-primary text-sm">{t('common.save')}</button>
              <button onClick={() => setShowAddForm(false)} className="kage-btn-ghost text-sm">{t('common.cancel')}</button>
            </div>
          </div>
        )}

        {/* Channels list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-kage-sub" />
          </div>
        ) : channels.length === 0 ? (
          <div className="kage-card p-8 text-center">
            <Bell size={32} className="text-kage-sub mx-auto mb-3" />
            <p className="text-sm text-kage-sub">No notification channels configured</p>
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map(ch => (
              <div key={ch.id} className="kage-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getChannelIcon(ch.type)}</span>
                    <div>
                      <span className="text-sm font-medium text-kage-text">{ch.name}</span>
                      <span className="text-xs text-kage-sub ml-2">{ch.type}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(ch.id, ch.enabled)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        ch.enabled
                          ? 'bg-kage-success/10 text-kage-success'
                          : 'bg-kage-bg text-kage-sub'
                      }`}
                    >
                      {ch.enabled ? t('notifications.enabled') : t('notifications.disabled')}
                    </button>

                    {/* Test */}
                    <button
                      onClick={() => handleTest(ch.id)}
                      disabled={testingId === ch.id}
                      className="p-1.5 rounded hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors"
                      title={t('notifications.test')}
                    >
                      {testingId === ch.id ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
                    </button>

                    {/* Expand */}
                    <button
                      onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)}
                      className="p-1 rounded hover:bg-white/5 text-kage-sub"
                    >
                      {expandedId === ch.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(ch.id)}
                      className="p-1.5 rounded hover:bg-white/5 text-kage-sub hover:text-kage-danger transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Test result */}
                {testResult?.id === ch.id && (
                  <div className={`mt-2 text-xs flex items-center gap-1 ${testResult.success ? 'text-kage-success' : 'text-kage-danger'}`}>
                    {testResult.success ? <Check size={12} /> : <X size={12} />}
                    {testResult.message}
                  </div>
                )}

                {/* Expanded details */}
                {expandedId === ch.id && (
                  <div className="mt-3 pt-3 border-t border-kage-border space-y-2 text-xs text-kage-sub">
                    {ch.event_filters?.length > 0 && (
                      <div>
                        <span className="font-medium">Events:</span>{' '}
                        {ch.event_filters.join(', ')}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Created:</span>{' '}
                      {new Date(ch.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
