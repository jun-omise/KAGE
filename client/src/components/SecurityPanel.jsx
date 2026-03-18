import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, ShieldAlert, Shield, Activity,
  DollarSign, Lock, FileText, AlertOctagon,
  ChevronDown, ChevronUp, Download, Loader2,
  CheckCircle, XCircle, Clock, AlertTriangle,
} from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const SCORE_LABELS = [
  { min: 90, key: 'security.excellent', cls: 'text-kage-success', bg: 'bg-kage-success/10', ring: 'ring-kage-success/30' },
  { min: 70, key: 'security.good', cls: 'text-kage-primary', bg: 'bg-kage-primary/10', ring: 'ring-kage-primary/30' },
  { min: 50, key: 'security.fair', cls: 'text-kage-warning', bg: 'bg-kage-warning/10', ring: 'ring-kage-warning/30' },
  { min: 0, key: 'security.poor', cls: 'text-kage-danger', bg: 'bg-kage-danger/10', ring: 'ring-kage-danger/30' },
];

function getScoreMeta(score) {
  return SCORE_LABELS.find((l) => score >= l.min) || SCORE_LABELS[SCORE_LABELS.length - 1];
}

function calcScore(config) {
  if (!config) return 100;
  let score = 100;
  const perms = config.permissions || {};
  if (perms.read === 'auto') score -= 5;
  if (perms.write === 'auto') score -= 15;
  if (perms.delete === 'auto') score -= 20;
  if (perms.external === 'auto') score -= 10;
  const costs = config.costLimits || {};
  if (!costs.perTask || costs.perTask > 5) score -= 5;
  if (!costs.daily || costs.daily > 50) score -= 5;
  if (!costs.monthly || costs.monthly > 500) score -= 5;
  return Math.max(0, Math.min(100, score));
}

function SectionHeader({ icon: Icon, title, children }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-kage-sub" />
        <h3 className="text-sm font-semibold text-kage-text">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function SecurityPanel() {
  const { t } = useI18n();
  const [config, setConfig] = useState(null);
  const [costData, setCostData] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLogs, setShowLogs] = useState(false);
  const [killing, setKilling] = useState(false);

  // Editable cost limits
  const [perTask, setPerTask] = useState('');
  const [daily, setDaily] = useState('');
  const [monthly, setMonthly] = useState('');

  // Editable permissions
  const [permissions, setPermissions] = useState({
    read: 'confirm',
    write: 'confirm',
    delete: 'confirm',
    external: 'confirm',
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cfgRes, costRes, evtRes, scoreRes] = await Promise.all([
        fetch('/api/security/config'),
        fetch('/api/security/cost'),
        fetch('/api/security/events'),
        fetch('/api/security/score'),
      ]);
      if (!cfgRes.ok) throw new Error('Failed to load security config');
      const cfg = await cfgRes.json();
      setConfig(cfg);

      // Map both legacy and new config formats
      setPerTask(String(cfg.cost?.per_task_limit ?? cfg.costLimits?.perTask ?? '1.00'));
      setDaily(String(cfg.cost?.daily_limit ?? cfg.costLimits?.daily ?? '10.00'));
      setMonthly(String(cfg.cost?.monthly_limit ?? cfg.costLimits?.monthly ?? '100.00'));
      const permsRaw = cfg.permissions || {};
      setPermissions({
        read: permsRaw.read || (permsRaw.auto_approve_read ? 'auto' : 'confirm'),
        write: permsRaw.write || (permsRaw.auto_approve_write ? 'auto' : 'confirm'),
        delete: permsRaw.delete || (permsRaw.auto_approve_delete ? 'auto' : 'confirm'),
        external: permsRaw.external || (permsRaw.auto_approve_external ? 'auto' : 'confirm'),
      });

      if (costRes.ok) {
        setCostData(await costRes.json());
      }
      if (evtRes.ok) {
        const evtData = await evtRes.json();
        setEvents(Array.isArray(evtData) ? evtData : evtData.events || []);
      }
      // Use server-calculated score if available
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setConfig(prev => ({ ...prev, _serverScore: scoreData.score }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        costLimits: {
          perTask: parseFloat(perTask) || 0,
          daily: parseFloat(daily) || 0,
          monthly: parseFloat(monthly) || 0,
        },
        permissions,
      };
      const res = await fetch('/api/security/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save config');
      const updated = await res.json();
      setConfig(updated);
      setSuccess(t('common.success'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [perTask, daily, monthly, permissions, t]);

  const handleKillAll = useCallback(async () => {
    setKilling(true);
    try {
      await fetch('/api/security/kill', { method: 'POST' });
    } catch {
      // best-effort
    } finally {
      setKilling(false);
    }
  }, []);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kage-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [events]);

  const score = config?._serverScore ?? calcScore(config);
  const scoreMeta = getScoreMeta(score);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-kage-primary" />
      </div>
    );
  }

  const todayTasks = costData?.tasksToday ?? 0;
  const todayCost = costData?.today ?? costData?.costToday ?? 0;
  const todayBlocks = costData?.blocksToday ?? 0;
  const pendingApprovals = costData?.pendingApprovals ?? 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Error / Success */}
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

        {/* Security Score */}
        <div className="kage-card p-5">
          <SectionHeader icon={ShieldCheck} title={t('security.score')} />
          <div className="flex items-center gap-5">
            <div className={`w-20 h-20 rounded-2xl ${scoreMeta.bg} ring-2 ${scoreMeta.ring} flex flex-col items-center justify-center`}>
              <span className={`text-2xl font-bold ${scoreMeta.cls}`}>{score}</span>
              <span className="text-[10px] text-kage-sub">/100</span>
            </div>
            <div>
              <span className={`text-lg font-semibold ${scoreMeta.cls}`}>{t(scoreMeta.key)}</span>
              <p className="text-xs text-kage-sub mt-1">
                {score >= 90
                  ? t('security.title')
                  : t('security.title')}
              </p>
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="kage-card p-5">
          <SectionHeader icon={Activity} title={`${t('common.today')} ${t('common.activity')}`} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t('common.tasks'), value: todayTasks, icon: CheckCircle, color: 'text-kage-success' },
              { label: t('common.cost'), value: `$${todayCost.toFixed(4)}`, icon: DollarSign, color: 'text-kage-primary' },
              { label: t('common.blocked'), value: todayBlocks, icon: XCircle, color: 'text-kage-danger' },
              { label: t('common.pending'), value: pendingApprovals, icon: Clock, color: 'text-kage-warning' },
            ].map((item) => (
              <div key={item.label} className="bg-kage-bg rounded-lg p-3 text-center">
                <item.icon size={16} className={`${item.color} mx-auto mb-1`} />
                <div className="text-lg font-bold text-kage-text">{item.value}</div>
                <div className="text-[10px] text-kage-sub">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost Control */}
        <div className="kage-card p-5">
          <SectionHeader icon={DollarSign} title={t('security.costControl')} />
          <p className="text-[10px] text-kage-sub mb-3">{t('security.costControlHelp')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-kage-sub mb-1">{t('security.perTask')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kage-sub">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={perTask}
                  onChange={(e) => setPerTask(e.target.value)}
                  className="kage-input w-full pl-7"
                />
              </div>
              <p className="text-[10px] text-kage-sub mt-1">{t('security.perTaskHelp')}</p>
            </div>
            <div>
              <label className="block text-xs text-kage-sub mb-1">{t('security.daily')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kage-sub">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                  className="kage-input w-full pl-7"
                />
              </div>
              <p className="text-[10px] text-kage-sub mt-1">{t('security.dailyHelp')}</p>
            </div>
            <div>
              <label className="block text-xs text-kage-sub mb-1">{t('security.monthly')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-kage-sub">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={monthly}
                  onChange={(e) => setMonthly(e.target.value)}
                  className="kage-input w-full pl-7"
                />
              </div>
              <p className="text-[10px] text-kage-sub mt-1">{t('security.monthlyHelp')}</p>
            </div>
          </div>
        </div>

        {/* Permission Policy */}
        <div className="kage-card p-5">
          <SectionHeader icon={Lock} title={t('security.permissions')} />
          <p className="text-[10px] text-kage-sub mb-3">{t('security.permissionsHelp')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['read', 'write', 'delete', 'external'].map((perm) => (
              <div key={perm}>
                <label className="block text-xs text-kage-sub mb-1">{t(`security.${perm}`)}</label>
                <select
                  value={permissions[perm]}
                  onChange={(e) => setPermissions((prev) => ({ ...prev, [perm]: e.target.value }))}
                  className="kage-input w-full"
                >
                  <option value="auto">{t('security.autoApprove')}</option>
                  <option value="confirm">{t('security.alwaysConfirm')}</option>
                  <option value="first">{t('security.firstConfirm')}</option>
                </select>
                <p className="text-[10px] text-kage-sub mt-1">{t(`security.${perm}Help`)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-[10px] text-kage-sub"><span className="font-medium">{t('security.autoApprove')}:</span> {t('security.autoApproveHelp')}</p>
            <p className="text-[10px] text-kage-sub"><span className="font-medium">{t('security.alwaysConfirm')}:</span> {t('security.alwaysConfirmHelp')}</p>
            <p className="text-[10px] text-kage-sub"><span className="font-medium">{t('security.firstConfirm')}:</span> {t('security.firstConfirmHelp')}</p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="kage-btn-primary px-6 disabled:opacity-40"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {t('common.loading')}
              </span>
            ) : (
              t('common.save')
            )}
          </button>
        </div>

        {/* Audit Log */}
        <div className="kage-card p-5">
          <SectionHeader icon={FileText} title={t('security.auditLog')}>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="kage-btn-ghost text-xs flex items-center gap-1 border border-kage-border px-2 py-1"
              >
                <Download size={12} /> {t('security.export')}
              </button>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="kage-btn-ghost text-xs flex items-center gap-1 border border-kage-border px-2 py-1"
              >
                {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {t('security.viewLogs')}
              </button>
            </div>
          </SectionHeader>
          {showLogs && (
            <div className="max-h-64 overflow-y-auto space-y-1 mt-2">
              {events.length === 0 ? (
                <p className="text-xs text-kage-sub text-center py-4">{t('common.loading')}</p>
              ) : (
                events.slice(0, 50).map((evt, i) => {
                  const eventType = evt.event_type || evt.level || '';
                  const isError = ['blocked', 'cost_limit', 'alert'].includes(eventType);
                  const isWarning = ['pii_detected'].includes(eventType);
                  const details = typeof evt.details === 'string' ? JSON.parse(evt.details || '{}') : (evt.details || {});
                  const message = details.reason || details.action || details.message || evt.message || eventType;
                  const timestamp = evt.created_at || evt.timestamp;

                  return (
                    <div key={evt.id || i} className="flex items-start gap-2 bg-kage-bg rounded-lg px-3 py-2">
                      {isError ? (
                        <XCircle size={14} className="text-kage-danger flex-shrink-0 mt-0.5" />
                      ) : isWarning ? (
                        <AlertTriangle size={14} className="text-kage-warning flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle size={14} className="text-kage-success flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isError ? 'bg-kage-danger/10 text-kage-danger' : isWarning ? 'bg-kage-warning/10 text-kage-warning' : 'bg-kage-success/10 text-kage-success'
                          }`}>{eventType}</span>
                          {evt.agent && <span className="text-[10px] text-kage-sub">{evt.agent}</span>}
                        </div>
                        <div className="text-xs text-kage-text truncate mt-0.5">{message}</div>
                        <div className="text-[10px] text-kage-sub">{timestamp ? new Date(timestamp).toLocaleString() : ''}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Emergency Stop */}
        <div className="kage-card p-5 border-kage-danger/30">
          <SectionHeader icon={AlertOctagon} title={t('security.emergencyStop')} />
          <button
            onClick={handleKillAll}
            disabled={killing}
            className="w-full kage-btn-danger py-3 text-sm font-semibold flex items-center justify-center gap-2"
          >
            {killing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ShieldAlert size={16} />
            )}
            {t('security.killAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
