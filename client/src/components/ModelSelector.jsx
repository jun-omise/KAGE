import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';

const TIER_COLORS = {
  flagship: 'text-yellow-400',
  balanced: 'text-kage-primary',
  fast: 'text-green-400',
};

const TIER_LABELS = {
  flagship: '🏆 Flagship',
  balanced: '⚡ Balanced',
  fast: '🚀 Fast',
};

export default function ModelSelector({ compact = false }) {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [savingKey, setSavingKey] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadModels() {
    try {
      const res = await fetch('/api/models');
      if (res.ok) setData(await res.json());
    } catch {}
  }

  async function switchModel(modelId) {
    try {
      const res = await fetch('/api/models/active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      if (res.ok) {
        await loadModels();
        setIsOpen(false);
      }
    } catch {}
  }

  async function saveApiKey(providerId) {
    if (!keyInput.trim()) return;
    try {
      await fetch('/api/models/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey: keyInput }),
      });
      setKeyInput('');
      setSavingKey(null);
      await loadModels();
    } catch {}
  }

  async function testModel(modelId) {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      });
      const result = await res.json();
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  if (!data) return null;

  const activeModel = data.providers
    ?.flatMap(p => p.models)
    ?.find(m => m.id === data.activeModel);

  const activeProvider = data.providers?.find(p => p.models?.some(m => m.id === data.activeModel));

  // Compact mode: just a dropdown in the header
  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-kage-card border border-kage-border hover:border-kage-primary/50 transition-colors text-sm"
        >
          <span className="text-kage-text font-medium">{activeModel?.name || data.activeModel}</span>
          <svg className={`w-3 h-3 text-kage-sub transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-2 w-80 max-h-[70vh] overflow-y-auto bg-kage-card border border-kage-border rounded-xl shadow-2xl z-50">
            {data.providers?.map(provider => (
              <div key={provider.id}>
                <div className="px-4 py-2 border-b border-kage-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-kage-sub uppercase tracking-wider">{provider.name}</span>
                  {provider.configured ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">API Key ✓</span>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSavingKey(provider.id); }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-kage-primary/20 text-kage-primary hover:bg-kage-primary/30"
                    >
                      + Add Key
                    </button>
                  )}
                </div>

                {savingKey === provider.id && (
                  <div className="px-4 py-2 border-b border-kage-border bg-kage-bg/50">
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyInput}
                        onChange={e => setKeyInput(e.target.value)}
                        placeholder={`${provider.envKey || 'API Key'}...`}
                        className="kage-input text-xs flex-1"
                        autoFocus
                      />
                      <button
                        onClick={() => saveApiKey(provider.id)}
                        className="px-2 py-1 text-xs rounded bg-kage-primary text-white hover:bg-kage-primary/80"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setSavingKey(null); setKeyInput(''); }}
                        className="px-2 py-1 text-xs rounded text-kage-sub hover:text-kage-text"
                      >
                        ✕
                      </button>
                    </div>
                    {provider.docsUrl && (
                      <a href={provider.docsUrl} target="_blank" rel="noopener" className="text-[10px] text-kage-primary/70 hover:text-kage-primary mt-1 inline-block">
                        Get API Key →
                      </a>
                    )}
                  </div>
                )}

                {provider.models?.map(model => (
                  <button
                    key={model.id}
                    onClick={() => switchModel(model.id)}
                    disabled={!provider.configured}
                    className={`w-full px-4 py-2 text-left hover:bg-kage-border/30 transition-colors flex items-center justify-between
                      ${model.id === data.activeModel ? 'bg-kage-primary/10 border-l-2 border-kage-primary' : ''}
                      ${!provider.configured ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div>
                      <span className="text-sm text-kage-text">{model.name}</span>
                      <span className={`ml-2 text-[10px] ${TIER_COLORS[model.tier]}`}>{TIER_LABELS[model.tier]}</span>
                    </div>
                    <span className="text-[10px] text-kage-sub">
                      ${model.inputCost}/{model.outputCost}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full mode: settings page panel
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-kage-text flex items-center gap-2">
          <span>🧠</span> AI Model Settings
        </h3>
      </div>

      {/* Active model display */}
      <div className="kage-card p-4">
        <div className="text-xs text-kage-sub mb-1">Active Model</div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-kage-text">{activeModel?.name || data.activeModel}</span>
            <span className="ml-3 text-sm text-kage-sub">{activeProvider?.name}</span>
          </div>
          {activeModel && (
            <div className="flex gap-3 text-xs text-kage-sub">
              <span>Context: {(activeModel.contextWindow / 1000).toFixed(0)}K</span>
              <span>Cost: ${activeModel.inputCost}/${activeModel.outputCost} /MTok</span>
            </div>
          )}
        </div>

        {/* Test button */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => testModel(data.activeModel)}
            disabled={testing}
            className="kage-btn-primary text-xs px-3 py-1.5"
          >
            {testing ? 'Testing...' : '🔌 Test Connection'}
          </button>
          {testResult && (
            <span className={`text-xs ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.success ? `✓ OK (${testResult.latency_ms}ms)` : `✕ ${testResult.error}`}
            </span>
          )}
        </div>
      </div>

      {/* Provider list */}
      {data.providers?.map(provider => (
        <div key={provider.id} className="kage-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-kage-text">{provider.name}</h4>
            <div className="flex items-center gap-2">
              {provider.configured ? (
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                  ✓ Connected ({provider.keyPreview})
                </span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-kage-border text-kage-sub">Not configured</span>
              )}
              <button
                onClick={() => setSavingKey(savingKey === provider.id ? null : provider.id)}
                className="text-xs text-kage-primary hover:text-kage-primary/80"
              >
                {provider.configured ? 'Update Key' : '+ Add Key'}
              </button>
            </div>
          </div>

          {savingKey === provider.id && (
            <div className="mb-3 p-3 rounded-lg bg-kage-bg border border-kage-border">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder={`Enter ${provider.envKey || provider.name} API Key`}
                  className="kage-input text-sm flex-1"
                  autoFocus
                />
                <button onClick={() => saveApiKey(provider.id)} className="kage-btn-primary text-xs px-4">Save</button>
                <button onClick={() => { setSavingKey(null); setKeyInput(''); }} className="kage-btn-ghost text-xs px-3">Cancel</button>
              </div>
              {provider.docsUrl && (
                <a href={provider.docsUrl} target="_blank" rel="noopener" className="text-xs text-kage-primary/70 hover:text-kage-primary mt-2 inline-block">
                  Get API Key from {provider.name} →
                </a>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {provider.models?.map(model => (
              <button
                key={model.id}
                onClick={() => provider.configured && switchModel(model.id)}
                disabled={!provider.configured}
                className={`text-left p-3 rounded-lg border transition-all
                  ${model.id === data.activeModel
                    ? 'border-kage-primary bg-kage-primary/10 ring-1 ring-kage-primary/30'
                    : 'border-kage-border hover:border-kage-border/80 bg-kage-bg/50'
                  }
                  ${!provider.configured ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-kage-bg'}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-kage-text">{model.name}</span>
                  <span className={`text-[10px] font-semibold ${TIER_COLORS[model.tier]}`}>
                    {TIER_LABELS[model.tier]}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-kage-sub">
                  <span>{(model.contextWindow / 1000).toFixed(0)}K ctx</span>
                  <span>${model.inputCost} in / ${model.outputCost} out</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
