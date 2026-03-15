import React, { useState, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { parseVariables, substituteVariables } from '../hooks/useTemplates.js';

export default function TemplateRunner({ template, onExecute, onClose }) {
  const { t } = useI18n();
  const [values, setValues] = useState({});
  const [executing, setExecuting] = useState(false);

  const vars = useMemo(() => {
    // Use template.variables if defined, otherwise parse from text
    if (template.variables && Array.isArray(template.variables)) {
      return template.variables;
    }
    return parseVariables(template.template_text || '').map(v => ({ name: v, label: v, default: '' }));
  }, [template]);

  // Initialize defaults
  useMemo(() => {
    const defaults = {};
    for (const v of vars) {
      defaults[v.name] = v.default || '';
    }
    setValues(defaults);
  }, [vars]);

  const preview = useMemo(() => {
    return substituteVariables(template.template_text || template.description || '', values);
  }, [template, values]);

  const handleExecute = async () => {
    setExecuting(true);
    try {
      await onExecute(template.id, values);
      onClose();
    } catch {
      // handled by parent
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-kage-card border border-kage-border rounded-xl w-full max-w-lg p-6 shadow-2xl space-y-4">
        <h3 className="text-lg font-bold text-kage-text">
          {template.name}
        </h3>
        {template.description && (
          <p className="text-sm text-kage-sub">{template.description}</p>
        )}

        {/* Variable inputs */}
        {vars.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-kage-sub uppercase">
              {t('templates.variables') || '変数'}
            </h4>
            {vars.map(v => (
              <div key={v.name}>
                <label className="block text-xs text-kage-sub mb-1 font-mono">{`{{${v.name}}}`}</label>
                <input
                  type="text"
                  value={values[v.name] || ''}
                  onChange={e => setValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                  placeholder={v.label || v.name}
                  className="w-full px-3 py-2 bg-kage-bg border border-kage-border rounded-lg text-sm text-kage-text focus:outline-none focus:border-kage-primary"
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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-kage-sub hover:text-kage-text transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="px-4 py-2 text-sm bg-kage-success text-white rounded-lg hover:bg-kage-success/80 disabled:opacity-50 transition-colors"
          >
            {executing ? t('common.loading') : (t('templates.execute') || '実行')}
          </button>
        </div>
      </div>
    </div>
  );
}
