import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, Sparkles, Clock, Hand, Globe, Zap,
  Save, Play, X, ChevronDown, ListTodo,
} from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import TaskCard from './TaskCard';

const TRIGGER_OPTIONS = [
  { value: 'schedule', icon: Clock },
  { value: 'manual', icon: Hand },
  { value: 'webhook', icon: Globe },
  { value: 'event', icon: Zap },
];

const CRON_PRESETS = [
  { label: 'Daily 8 AM', value: '0 8 * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Every 30 min', value: '*/30 * * * *' },
  { label: 'Weekdays 9 AM', value: '0 9 * * 1-5' },
  { label: 'Weekly Monday', value: '0 9 * * 1' },
  { label: 'Monthly 1st', value: '0 0 1 * *' },
];

const EMPTY_FORM = {
  name: '',
  description: '',
  trigger: 'manual',
  cron: '',
  enabled: true,
};

export default function TaskBuilder() {
  const { t } = useI18n();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editor state
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [plan, setPlan] = useState(null);

  // Save/run state
  const [saving, setSaving] = useState(false);
  const [testRunning, setTestRunning] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : data.tasks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const openCreate = useCallback(() => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setPlan(null);
    setEditing(true);
  }, []);

  const openEdit = useCallback((task) => {
    const triggerConfig = typeof task.trigger_config === 'string'
      ? JSON.parse(task.trigger_config) : task.trigger_config;
    setForm({
      name: task.name || '',
      description: task.description || '',
      trigger: task.trigger_type === 'cron' ? 'schedule' : (task.trigger_type || 'manual'),
      cron: triggerConfig?.cron || '',
      enabled: task.enabled !== 0 && task.enabled !== false,
    });
    setEditingId(task.id);
    setPlan(null);
    setEditing(true);
  }, []);

  const closeEditor = useCallback(() => {
    setEditing(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setPlan(null);
  }, []);

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!form.description.trim()) return;
    setAnalyzing(true);
    setPlan(null);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'Analyze the following task description and return a JSON object with: steps (array of strings), permissions (array of strings like "read", "write", "external"), estimatedCost (number in USD). Be concise.',
            },
            { role: 'user', content: form.description },
          ],
        }),
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();
      // Try to parse plan from response
      let parsed = data;
      if (data.message) {
        try {
          const jsonMatch = data.message.match(/\{[\s\S]*\}/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : data;
        } catch {
          parsed = { steps: [data.message], permissions: [], estimatedCost: 0 };
        }
      }
      setPlan({
        steps: parsed.steps || [],
        permissions: parsed.permissions || [],
        estimatedCost: parsed.estimatedCost || 0,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }, [form.description]);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      // Map frontend form fields to backend schema
      const triggerType = form.trigger === 'schedule' ? 'cron' : form.trigger;
      const payload = {
        name: form.name,
        description: form.description,
        trigger_type: triggerType,
        enabled: form.enabled,
      };

      // Build trigger_config for cron tasks
      if (triggerType === 'cron' && form.cron) {
        payload.trigger_config = { cron: form.cron };
      }

      if (plan) {
        payload.plan = plan;
      }

      const url = editingId ? `/api/tasks/${editingId}` : '/api/tasks';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save task');
      await fetchTasks();
      closeEditor();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [form, plan, editingId, fetchTasks, closeEditor]);

  const handleTestRun = useCallback(async () => {
    if (!editingId) return;
    setTestRunning(true);
    try {
      const res = await fetch(`/api/tasks/${editingId}/run`, { method: 'POST' });
      if (!res.ok) throw new Error('Test run failed');
    } catch (err) {
      setError(err.message);
    } finally {
      setTestRunning(false);
    }
  }, [editingId]);

  const handleDelete = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  }, [fetchTasks]);

  const handleRun = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/tasks/${id}/run`, { method: 'POST' });
      if (!res.ok) throw new Error('Run failed');
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  }, [fetchTasks]);

  const handleToggle = useCallback(async (id, enabled) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      await fetchTasks();
    } catch (err) {
      setError(err.message);
    }
  }, [fetchTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-kage-primary" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ListTodo size={20} className="text-kage-primary" />
            <h2 className="text-lg font-bold text-kage-text">{t('tasks.title')}</h2>
          </div>
          {!editing && (
            <button onClick={openCreate} className="kage-btn-primary text-sm flex items-center gap-1.5">
              <Plus size={14} />
              {t('tasks.newTask')}
            </button>
          )}
        </div>

        {error && (
          <div className="bg-kage-danger/10 border border-kage-danger/30 rounded-lg px-4 py-2 text-sm text-kage-danger mb-4">
            {error}
          </div>
        )}

        {/* Editor */}
        {editing && (
          <div className="kage-card p-5 mb-6 animate-slide-up">
            <div className="space-y-4">
              {/* Task Name */}
              <div>
                <label className="block text-xs text-kage-sub mb-1">{t('tasks.name')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="kage-input w-full"
                  placeholder={t('tasks.name')}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-kage-sub mb-1">{t('tasks.description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="kage-input w-full min-h-[80px] resize-y"
                  placeholder={t('tasks.description')}
                  rows={3}
                />
              </div>

              {/* Analyze Button */}
              <div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !form.description.trim()}
                  className="kage-btn-ghost text-sm border border-kage-border flex items-center gap-1.5 disabled:opacity-40"
                >
                  {analyzing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} className="text-kage-primary" />
                  )}
                  {t('tasks.analyze')}
                </button>
              </div>

              {/* Analysis Result */}
              {plan && (
                <div className="bg-kage-bg rounded-lg p-4 space-y-3 animate-slide-up">
                  {/* Steps */}
                  {plan.steps.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-kage-text mb-1.5">Execution Plan</div>
                      <ol className="space-y-1">
                        {plan.steps.map((step, i) => (
                          <li key={i} className="text-xs text-kage-sub flex items-start gap-2">
                            <span className="text-kage-primary font-mono flex-shrink-0">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {/* Permissions */}
                  {plan.permissions.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-kage-text mb-1.5">{t('tasks.permissions')}</div>
                      <div className="flex flex-wrap gap-1">
                        {plan.permissions.map((perm) => (
                          <span key={perm} className="kage-badge-warning">{perm}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Estimated Cost */}
                  {plan.estimatedCost > 0 && (
                    <div className="text-xs text-kage-sub">
                      {t('tasks.estimatedCost')}: <span className="font-mono text-kage-warning">${plan.estimatedCost.toFixed(4)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Trigger Type */}
              <div>
                <label className="block text-xs text-kage-sub mb-1.5">{t('tasks.trigger')}</label>
                <div className="flex gap-2">
                  {TRIGGER_OPTIONS.map(({ value, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => updateField('trigger', value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-all ${
                        form.trigger === value
                          ? 'border-kage-primary bg-kage-primary/10 text-kage-primary'
                          : 'border-kage-border text-kage-sub hover:border-kage-primary/30'
                      }`}
                    >
                      <Icon size={12} />
                      {t(`tasks.${value}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cron Expression (when schedule) */}
              {form.trigger === 'schedule' && (
                <div className="space-y-2 animate-slide-up">
                  <label className="block text-xs text-kage-sub mb-1">{t('tasks.cron')}</label>
                  <input
                    type="text"
                    value={form.cron}
                    onChange={(e) => updateField('cron', e.target.value)}
                    className="kage-input w-full font-mono text-sm"
                    placeholder="0 8 * * *"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {CRON_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => updateField('cron', preset.value)}
                        className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                          form.cron === preset.value
                            ? 'border-kage-primary bg-kage-primary/10 text-kage-primary'
                            : 'border-kage-border text-kage-sub hover:border-kage-primary/30'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-kage-border">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim()}
                  className="kage-btn-primary text-sm flex items-center gap-1.5 disabled:opacity-40"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {t('tasks.save')}
                </button>
                {editingId && (
                  <button
                    onClick={handleTestRun}
                    disabled={testRunning}
                    className="kage-btn-ghost text-sm border border-kage-border flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {testRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    {t('tasks.testRun')}
                  </button>
                )}
                <button
                  onClick={closeEditor}
                  className="kage-btn-ghost text-sm border border-kage-border flex items-center gap-1.5"
                >
                  <X size={14} />
                  {t('tasks.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Task List */}
        {tasks.length === 0 && !editing ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-kage-primary/10 flex items-center justify-center mx-auto mb-3">
              <ListTodo size={24} className="text-kage-primary" />
            </div>
            <p className="text-sm text-kage-sub">{t('tasks.description')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={openEdit}
                onDelete={handleDelete}
                onRun={handleRun}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
