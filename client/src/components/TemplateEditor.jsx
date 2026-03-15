import React, { useState, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { parseVariables, substituteVariables } from '../hooks/useTemplates.js';

export default function TemplateEditor({ template, onSave, onCancel }) {
  const { t } = useI18n();
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [templateText, setTemplateText] = useState(template?.template_text || '');
  const [variableConfigs, setVariableConfigs] = useState(template?.variables || []);
  const [saving, setSaving] = useState(false);

  const detectedVars = useMemo(() => parseVariables(templateText), [templateText]);

  // Sync detected vars with variable configs
  useMemo(() => {
    const existing = new Map(variableConfigs.map(v => [v.name, v]));
    const updated = detectedVars.map(name =>
      existing.get(name) || { name, label: name, default: '' }
    );
    setVariableConfigs(updated);
  }, [detectedVars]);

  const updateVarConfig = (varName, field, value) => {
    setVariableConfigs(prev =>
      prev.map(v => v.name === varName ? { ...v, [field]: value } : v)
    );
  };

  // Preview with sample values
  const preview = useMemo(() => {
    const sampleValues = {};
    for (const v of variableConfigs) {
      sampleValues[v.name] = v.default || `[${v.label || v.name}]`;
    }
    return substituteVariables(templateText, sampleValues);
  }, [templateText, variableConfigs]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        template_text: templateText,
        variables: variableConfigs,
        is_template: true,
      });
    } catch {
      // handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-xs text-kage-sub mb-1">{t('tasks.name')}</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 bg-kage-bg border border-kage-border rounded-lg text-sm text-kage-text focus:outline-none focus:border-kage-primary"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-kage-sub mb-1">{t('tasks.description')}</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full px-3 py-2 bg-kage-bg border border-kage-border rounded-lg text-sm text-kage-text focus:outline-none focus:border-kage-primary"
        />
      </div>

      {/* Template Text */}
      <div>
        <label className="block text-xs text-kage-sub mb-1">
          {t('templates.text') || 'テンプレートテキスト'}
        </label>
        <textarea
          value={templateText}
          onChange={e => setTemplateText(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 bg-kage-bg border border-kage-border rounded-lg text-sm text-kage-text font-mono focus:outline-none focus:border-kage-primary resize-y"
        />
      </div>

      {/* Variable configs */}
      {variableConfigs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-kage-sub uppercase">
            {t('templates.variableSettings') || '変数設定'}
          </h4>
          {variableConfigs.map(v => (
            <div key={v.name} className="flex items-center gap-2">
              <span className="text-xs font-mono text-kage-primary min-w-[80px]">{`{{${v.name}}}`}</span>
              <input
                type="text"
                value={v.label}
                onChange={e => updateVarConfig(v.name, 'label', e.target.value)}
                placeholder="ラベル"
                className="flex-1 px-2 py-1 bg-kage-bg border border-kage-border rounded text-xs text-kage-text focus:outline-none focus:border-kage-primary"
              />
              <input
                type="text"
                value={v.default}
                onChange={e => updateVarConfig(v.name, 'default', e.target.value)}
                placeholder="デフォルト値"
                className="flex-1 px-2 py-1 bg-kage-bg border border-kage-border rounded text-xs text-kage-text focus:outline-none focus:border-kage-primary"
              />
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      <div>
        <h4 className="text-xs font-medium text-kage-sub uppercase mb-1">
          {t('templates.preview') || 'プレビュー'}
        </h4>
        <div className="px-3 py-2 bg-kage-bg border border-kage-border rounded-lg text-sm text-kage-text/80 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
          {preview}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-kage-sub hover:text-kage-text transition-colors"
          >
            {t('common.cancel')}
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="px-4 py-2 text-sm bg-kage-primary text-white rounded-lg hover:bg-kage-primary/80 disabled:opacity-50 transition-colors"
        >
          {saving ? t('common.loading') : t('common.save')}
        </button>
      </div>
    </div>
  );
}
