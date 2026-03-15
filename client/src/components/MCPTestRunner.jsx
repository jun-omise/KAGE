import React, { useState, useEffect, useCallback } from 'react';
import { Play, Loader2, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

export default function MCPTestRunner({ tools }) {
  const { t } = useI18n();
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [selectedServer, setSelectedServer] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch('/api/tools/test-scenarios')
      .then(res => res.json())
      .then(data => {
        setScenarios(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleRun = useCallback(async () => {
    if (!selectedScenario || !selectedServer) return;
    setRunning(true);
    setResults(null);
    try {
      const res = await fetch('/api/tools/test-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId: selectedScenario, serverId: selectedServer }),
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setResults({ success: false, error: err.message, steps: [] });
    } finally {
      setRunning(false);
    }
  }, [selectedScenario, selectedServer]);

  const connectedTools = (tools || []).filter(t => t.status === 'connected');

  return (
    <div className="kage-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-kage-primary" />
          <span className="text-sm font-semibold text-kage-text">
            {t('tools.testRunner') || 'MCP Test Runner'}
          </span>
        </div>
        {expanded ? <ChevronUp size={16} className="text-kage-sub" /> : <ChevronDown size={16} className="text-kage-sub" />}
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3 animate-slide-up">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-kage-sub py-2">
              <Loader2 size={14} className="animate-spin" />
              Loading scenarios...
            </div>
          ) : (
            <>
              {/* Scenario selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-kage-sub mb-1">
                    {t('tools.testScenario') || 'Test Scenario'}
                  </label>
                  <select
                    value={selectedScenario || ''}
                    onChange={(e) => setSelectedScenario(e.target.value || null)}
                    className="kage-input w-full"
                  >
                    <option value="">Select scenario...</option>
                    {scenarios.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-kage-sub mb-1">
                    {t('tools.targetServer') || 'Target Server'}
                  </label>
                  <select
                    value={selectedServer}
                    onChange={(e) => setSelectedServer(e.target.value)}
                    className="kage-input w-full"
                  >
                    <option value="">Select server...</option>
                    {connectedTools.map(tool => (
                      <option key={tool.id} value={tool.name}>{tool.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scenario description */}
              {selectedScenario && (
                <div className="text-xs text-kage-sub bg-kage-bg rounded-lg px-3 py-2">
                  {scenarios.find(s => s.id === selectedScenario)?.description}
                  <div className="mt-1.5 space-y-0.5">
                    {scenarios.find(s => s.id === selectedScenario)?.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[10px]">
                        <span className="w-4 h-4 rounded-full bg-kage-card flex items-center justify-center text-kage-sub flex-shrink-0">
                          {i + 1}
                        </span>
                        {step.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Run button */}
              <button
                onClick={handleRun}
                disabled={running || !selectedScenario || !selectedServer}
                className="kage-btn-primary text-sm flex items-center gap-1.5 disabled:opacity-40"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {t('tools.runTests') || 'Run Test'}
              </button>

              {/* Results */}
              {results && (
                <div className="space-y-2 animate-slide-up">
                  {/* Overall result */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                    results.success
                      ? 'bg-kage-success/10 text-kage-success'
                      : 'bg-kage-danger/10 text-kage-danger'
                  }`}>
                    {results.success ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    <span className="font-medium">
                      {results.success ? 'All steps passed' : results.error || 'Some steps failed'}
                    </span>
                  </div>

                  {/* Step results */}
                  {results.steps && results.steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 bg-kage-bg rounded-lg px-3 py-2">
                      <div className="mt-0.5 flex-shrink-0">
                        {step.status === 'pass' ? (
                          <CheckCircle size={14} className="text-kage-success" />
                        ) : step.status === 'fail' ? (
                          <XCircle size={14} className="text-kage-danger" />
                        ) : (
                          <AlertTriangle size={14} className="text-kage-warning" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-kage-text">
                          Step {i + 1}: {step.description}
                        </div>
                        {step.error && (
                          <div className="text-[10px] text-kage-danger mt-0.5 truncate">
                            {step.error}
                          </div>
                        )}
                        {step.result && (
                          <div className="text-[10px] text-kage-sub mt-0.5 truncate font-mono">
                            {typeof step.result === 'string' ? step.result : JSON.stringify(step.result).slice(0, 200)}
                          </div>
                        )}
                      </div>
                      {step.duration_ms != null && (
                        <span className="text-[9px] text-kage-sub flex-shrink-0">
                          {step.duration_ms}ms
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
