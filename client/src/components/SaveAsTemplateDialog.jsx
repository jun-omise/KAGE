import React, { useState, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { parseVariables } from '../hooks/useTemplates.js';

export default function SaveAsTemplateDialog({ message, onSave, onClose }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateText, setTemplateText] = useState(message || '');
  const [saving, setSaving] = useState(false);

  const detectedVars = useMemo(() => parseVariables(templateText), [templateText]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        template_text: templateText,
        variables: detectedVars.map(v => ({ name: v, label: v, default: '' })),
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-kage-card border border-kage-border rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-kage-text">
          {t('templates.saveAs') || 'テンプレートとして保存'}
        </h3>

        {/* Name */}
        <div>
          <label className="block text-xs text-kage-sub mb-1">{t('tasks.name')}</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('templates.namePlaceholder') || 'テンプレート名'}
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
            placeholder={t('templates.descPlaceholder') || '説明（オプション）'}
            className="w-full px-3 py-2 bg-kage-bg border border-kage-border rounded-lg text-sm text-kage-text focus:outline-none focus:border-kage-primary"
          />
        </div>

        {/* Template text */}
        <div>
          <label className="block text-xs text-kage-sub mb-1">
            {t('templates.text') || 'テンプレートテキスト'}
            <span className="ml-2 text-kage-primary">{'{{変数名}}'} {t('templates.varHint') || 'で変数を埋め込み'}</span>
          </label>
          <textarea
            value={templateText}
            onChange={e => setTemplateText(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 bg-kage-bg border border-kage-border rounded-lg text-sm text-kage-text font-mono focus:outline-none focus:border-kage-primary resize-y"
          />
        </div>

        {/* Detected variables */}
        {detectedVars.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-kage-sub">{t('templates.detectedVars') || '検出された変数'}:</span>
            {detectedVars.map(v => (
              <span key={v} className="px-2 py-0.5 bg-kage-primary/20 text-kage-primary text-xs rounded-full font-mono">
                {`{{${v}}}`}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-kage-sub hover:text-kage-text transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-kage-primary text-white rounded-lg hover:bg-kage-primary/80 disabled:opacity-50 transition-colors"
          >
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
