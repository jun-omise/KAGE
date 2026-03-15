import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Save, Trash2, Loader2, Shield } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const PLATFORMS = [
  {
    id: 'line',
    name: 'LINE',
    icon: '\uD83D\uDFE2',
    fields: [
      { key: 'channelSecret', label: 'Channel Secret', type: 'password' },
      { key: 'channelAccessToken', label: 'Channel Access Token', type: 'password' },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '\uD83D\uDCAC',
    fields: [
      { key: 'accountSid', label: 'Twilio Account SID', type: 'text' },
      { key: 'authToken', label: 'Twilio Auth Token', type: 'password' },
      { key: 'fromNumber', label: 'From Number', type: 'tel' },
      { key: 'verifyToken', label: 'Verify Token', type: 'text' },
    ],
  },
  {
    id: 'messenger',
    name: 'FB Messenger',
    icon: '\uD83D\uDCAD',
    fields: [
      { key: 'pageAccessToken', label: 'Page Access Token', type: 'password' },
      { key: 'appSecret', label: 'App Secret', type: 'password' },
      { key: 'verifyToken', label: 'Verify Token', type: 'text' },
    ],
  },
];

export default function MessagingConfig() {
  const { t } = useI18n();
  const [configs, setConfigs] = useState({});
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [configRes, sessionsRes] = await Promise.all([
        fetch('/api/messaging/config'),
        fetch('/api/messaging/sessions'),
      ]);
      if (configRes.ok) setConfigs(await configRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
    } catch (err) {
      console.error('Load messaging data error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (platformId) => {
    setSaving(platformId);
    try {
      await fetch(`/api/messaging/config/${platformId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs[platformId] || {}),
      });
    } catch (err) {
      console.error('Save config error:', err);
    } finally {
      setSaving(null);
    }
  };

  const handleRevokeSession = async (id) => {
    try {
      await fetch(`/api/messaging/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Revoke session error:', err);
    }
  };

  const updateConfig = (platformId, key, value) => {
    setConfigs(prev => ({
      ...prev,
      [platformId]: { ...prev[platformId], [key]: value },
    }));
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-kage-sub" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <MessageSquare size={22} className="text-kage-primary" />
          <h2 className="text-lg font-semibold text-kage-text">{t('messaging.title')}</h2>
        </div>

        <div className="kage-card p-3 bg-kage-primary/5 border-kage-primary/20">
          <div className="flex items-center gap-2 text-sm text-kage-primary">
            <Shield size={16} />
            <span>First message from new users must contain your KAGE passphrase for authentication. Rate limit: 30 messages/hour.</span>
          </div>
        </div>

        {/* Platform configs */}
        {PLATFORMS.map(platform => (
          <div key={platform.id} className="kage-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{platform.icon}</span>
                <span className="text-sm font-semibold text-kage-text">{platform.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-kage-sub">
                  <input
                    type="checkbox"
                    checked={configs[platform.id]?.enabled || false}
                    onChange={(e) => updateConfig(platform.id, 'enabled', e.target.checked)}
                    className="rounded border-kage-border"
                  />
                  Enabled
                </label>
                <button
                  onClick={() => handleSave(platform.id)}
                  disabled={saving === platform.id}
                  className="kage-btn-primary text-xs flex items-center gap-1"
                >
                  {saving === platform.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  {t('common.save')}
                </button>
              </div>
            </div>

            {/* Webhook URL */}
            <div className="text-xs">
              <span className="text-kage-sub">{t('messaging.webhookUrl')}: </span>
              <code className="bg-kage-bg px-1.5 py-0.5 rounded text-kage-primary font-mono">
                {baseUrl}/api/webhooks/{platform.id}
              </code>
            </div>

            {/* Config fields */}
            <div className="grid grid-cols-1 gap-2">
              {platform.fields.map(field => (
                <div key={field.key}>
                  <label className="text-xs text-kage-sub block mb-0.5">{field.label}</label>
                  <input
                    type={field.type}
                    value={configs[platform.id]?.[field.key] || ''}
                    onChange={(e) => updateConfig(platform.id, field.key, e.target.value)}
                    className="kage-input w-full text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Active sessions */}
        {sessions.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-kage-text">{t('messaging.sessions')}</h3>
            {sessions.map(session => (
              <div key={session.id} className="kage-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    session.authenticated ? 'bg-kage-success/10 text-kage-success' : 'bg-kage-warning/10 text-kage-warning'
                  }`}>
                    {session.platform}
                  </span>
                  <span className="text-sm text-kage-text">{session.platform_user_id}</span>
                  <span className="text-xs text-kage-sub">
                    Last active: {new Date(session.last_active).toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  className="p-1.5 rounded hover:bg-white/5 text-kage-sub hover:text-kage-danger transition-colors"
                  title={t('messaging.revoke')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
