import { useState, useCallback } from 'react';
import {
  Shield, ShieldCheck, Key, Eye, EyeOff, ExternalLink,
  CheckCircle, XCircle, Loader2, ChevronRight, Zap, Lock, Sparkles,
} from 'lucide-react';

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    key: 'anthropic',
    required: true,
    icon: '🟣',
    placeholder: 'sk-ant-api03-...',
    description: 'Claude Opus / Sonnet / Haiku models',
    docsUrl: 'https://console.anthropic.com/',
    steps: [
      'console.anthropic.com にアクセス',
      'アカウントを作成またはログイン',
      '「API Keys」をクリック',
      '「Create Key」で新しいキーを生成',
      'キーをコピーして下に貼り付け',
    ],
    stepsEn: [
      'Go to console.anthropic.com',
      'Create an account or sign in',
      'Click "API Keys"',
      'Click "Create Key" to generate a new key',
      'Copy the key and paste it below',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    key: 'openai',
    required: false,
    icon: '🟢',
    placeholder: 'sk-proj-...',
    description: 'GPT-4.1 / GPT-4o / o3 / o4 models',
    docsUrl: 'https://platform.openai.com/api-keys',
    steps: [
      'platform.openai.com にアクセス',
      'アカウントを作成またはログイン',
      '左メニューの「API Keys」をクリック',
      '「Create new secret key」で生成',
      'キーをコピー（一度しか表示されません）',
    ],
    stepsEn: [
      'Go to platform.openai.com',
      'Create an account or sign in',
      'Click "API Keys" in the left menu',
      'Click "Create new secret key"',
      'Copy the key (shown only once)',
    ],
  },
  {
    id: 'google',
    name: 'Google (Gemini)',
    key: 'google',
    required: false,
    icon: '🔵',
    placeholder: 'AIza...',
    description: 'Gemini 2.5 Pro / Flash models',
    docsUrl: 'https://aistudio.google.com/apikey',
    steps: [
      'aistudio.google.com/apikey にアクセス',
      'Googleアカウントでログイン',
      '「APIキーを作成」をクリック',
      'プロジェクトを選択して生成',
      'キーをコピーして下に貼り付け',
    ],
    stepsEn: [
      'Go to aistudio.google.com/apikey',
      'Sign in with Google account',
      'Click "Create API Key"',
      'Select a project and generate',
      'Copy the key and paste it below',
    ],
  },
  {
    id: 'groq',
    name: 'Groq (Llama / Qwen)',
    key: 'groq',
    required: false,
    icon: '🟠',
    placeholder: 'gsk_...',
    description: 'Llama 4, DeepSeek R1, Qwen — ultra-fast inference',
    docsUrl: 'https://console.groq.com/keys',
    steps: [
      'console.groq.com にアクセス',
      'アカウントを作成（無料）',
      '「API Keys」→「Create API Key」',
      'キーをコピー',
      '無料枠: 6000 tokens/min',
    ],
    stepsEn: [
      'Go to console.groq.com',
      'Create a free account',
      '"API Keys" → "Create API Key"',
      'Copy the key',
      'Free tier: 6000 tokens/min',
    ],
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    key: 'xai',
    required: false,
    icon: '⚫',
    placeholder: 'xai-...',
    description: 'Grok 3 / Grok 3 Mini models',
    docsUrl: 'https://console.x.ai/',
    steps: [
      'console.x.ai にアクセス',
      'Xアカウントでログイン',
      '「API Keys」をクリック',
      '「Create API Key」で生成',
      'キーをコピー',
    ],
    stepsEn: [
      'Go to console.x.ai',
      'Sign in with X account',
      'Click "API Keys"',
      'Click "Create API Key"',
      'Copy the key',
    ],
  },
];

function detectLang() {
  return (navigator.language || 'en').startsWith('ja') ? 'ja' : 'en';
}

export default function SetupWizard({ onComplete }) {
  const lang = detectLang();
  const isJa = lang === 'ja';

  const [step, setStep] = useState(0);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [passphraseError, setPassphraseError] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  const [apiKeys, setApiKeys] = useState({});
  const [showKeys, setShowKeys] = useState({});
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState({});
  const [expandedGuide, setExpandedGuide] = useState(null);

  const [securityLevel, setSecurityLevel] = useState('balanced');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const totalSteps = PROVIDERS.length + 3;

  const handlePassphraseNext = () => {
    if (passphrase.length < 8) {
      setPassphraseError(isJa ? 'パスフレーズは8文字以上にして下さい' : 'Passphrase must be at least 8 characters');
      return;
    }
    if (passphrase !== passphraseConfirm) {
      setPassphraseError(isJa ? 'パスフレーズが一致しません' : 'Passphrases do not match');
      return;
    }
    setPassphraseError('');
    setStep(2);
  };

  const testApiKey = useCallback(async (providerId) => {
    const key = apiKeys[providerId];
    if (!key?.trim()) return;

    setTesting(prev => ({ ...prev, [providerId]: true }));
    setTestResults(prev => ({ ...prev, [providerId]: null }));

    try {
      await fetch('/api/models/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, apiKey: key }),
      });

      const modelsRes = await fetch('/api/models');
      const modelsData = await modelsRes.json();
      const providerData = modelsData.providers?.find(p => p.id === providerId);
      const firstModel = providerData?.models?.[0];

      if (firstModel) {
        const testRes = await fetch('/api/models/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId: firstModel.id }),
        });
        const result = await testRes.json();
        setTestResults(prev => ({ ...prev, [providerId]: result }));
      } else {
        setTestResults(prev => ({ ...prev, [providerId]: { success: true, latency_ms: 0 } }));
      }
    } catch (err) {
      setTestResults(prev => ({ ...prev, [providerId]: { success: false, error: err.message } }));
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }));
    }
  }, [apiKeys]);

  const handleFinish = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passphrase,
          apiKey: apiKeys.anthropic || '',
          securityLevel,
        }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('kage_token', data.token);
      }

      for (const [providerId, key] of Object.entries(apiKeys)) {
        if (key?.trim() && providerId !== 'anthropic') {
          await fetch('/api/models/keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ providerId, apiKey: key }),
          });
        }
      }

      onComplete();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const currentProviderIdx = step - 2;
  const isProviderStep = step >= 2 && step < 2 + PROVIDERS.length;
  const isSecurityStep = step === 2 + PROVIDERS.length;
  const isDoneStep = step === 2 + PROVIDERS.length + 1;
  const configuredCount = Object.values(apiKeys).filter(k => k?.trim()).length;

  return (
    <div className="min-h-screen bg-kage-bg flex items-center justify-center px-4 py-8">
      <div className="kage-card max-w-lg w-full animate-slide-up overflow-hidden">
        <div className="h-1 bg-kage-border">
          <div
            className="h-full bg-kage-primary transition-all duration-500"
            style={{ width: `${((step + 1) / (totalSteps + 1)) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* ───── Step 0: Welcome ───── */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-kage-primary/10 flex items-center justify-center mx-auto mb-5">
                <Shield size={40} className="text-kage-primary" />
              </div>
              <h1 className="text-3xl font-bold text-kage-text mb-2">KAGE</h1>
              <p className="text-kage-sub text-sm mb-6">
                {isJa ? 'セキュアなマルチエージェントAIアシスタント' : 'Secure Multi-Agent AI Assistant'}
              </p>
              <div className="space-y-3 text-left mb-6">
                {[
                  { icon: '🧠', text: isJa ? '4つのAIエージェントが連携して高精度な回答を生成' : '4 AI agents collaborate for high-accuracy responses' },
                  { icon: '🔌', text: isJa ? '67以上のアプリと連携 (GitHub, Slack, Gmail...)' : '67+ app integrations (GitHub, Slack, Gmail...)' },
                  { icon: '🛡️', text: isJa ? 'PII検出、コスト管理、監査ログで安全に運用' : 'PII detection, cost control, audit logging for safety' },
                  { icon: '🤖', text: isJa ? 'Claude, GPT, Gemini, Llama, Grok等マルチモデル対応' : 'Multi-model: Claude, GPT, Gemini, Llama, Grok & more' },
                ].map(({ icon, text }, i) => (
                  <div key={i} className="flex items-start gap-3 bg-kage-bg rounded-lg px-4 py-3">
                    <span className="text-lg">{icon}</span>
                    <span className="text-sm text-kage-text">{text}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="kage-btn-primary w-full text-base py-3">
                {isJa ? 'セットアップを開始' : 'Start Setup'} <ChevronRight size={18} className="inline ml-1" />
              </button>
            </div>
          )}

          {/* ───── Step 1: Passphrase ───── */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-kage-primary/10 flex items-center justify-center">
                  <Lock size={20} className="text-kage-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-kage-text">
                    {isJa ? 'パスフレーズの設定' : 'Set Passphrase'}
                  </h2>
                  <p className="text-xs text-kage-sub">
                    {isJa ? 'KAGEへのアクセスを保護します' : 'Protects access to KAGE'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={isJa ? 'パスフレーズ（8文字以上）' : 'Passphrase (8+ characters)'}
                    className="kage-input w-full pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-kage-sub hover:text-kage-text"
                  >
                    {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphraseConfirm}
                  onChange={(e) => setPassphraseConfirm(e.target.value)}
                  placeholder={isJa ? 'パスフレーズを確認' : 'Confirm passphrase'}
                  className="kage-input w-full"
                />
                {passphraseError && (
                  <p className="text-xs text-kage-danger flex items-center gap-1">
                    <XCircle size={12} /> {passphraseError}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(0)} className="kage-btn-ghost text-sm flex-1 border border-kage-border">
                  {isJa ? '戻る' : 'Back'}
                </button>
                <button
                  onClick={handlePassphraseNext}
                  disabled={!passphrase || !passphraseConfirm}
                  className="kage-btn-primary text-sm flex-1 disabled:opacity-40"
                >
                  {isJa ? '次へ' : 'Next'}
                </button>
              </div>
            </div>
          )}

          {/* ───── Steps 2-N: Provider API Keys ───── */}
          {isProviderStep && (() => {
            const provider = PROVIDERS[currentProviderIdx];
            const key = apiKeys[provider.id] || '';
            const result = testResults[provider.id];
            const isTesting = testing[provider.id];
            const showKey = showKeys[provider.id];
            const isGuideOpen = expandedGuide === provider.id;
            const steps = isJa ? provider.steps : provider.stepsEn;

            return (
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{provider.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-kage-text">{provider.name}</h2>
                      {provider.required ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-kage-danger/20 text-kage-danger font-semibold">
                          {isJa ? '必須' : 'Required'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-kage-border text-kage-sub">
                          {isJa ? '任意' : 'Optional'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-kage-sub">{provider.description}</p>
                  </div>
                </div>

                <button
                  onClick={() => setExpandedGuide(isGuideOpen ? null : provider.id)}
                  className="w-full mt-3 mb-3 text-left"
                >
                  <div className="flex items-center gap-2 text-kage-primary text-sm hover:text-kage-primary/80">
                    <Key size={14} />
                    <span>{isJa ? 'API Keyの取得方法' : 'How to get API Key'}</span>
                    <ChevronRight size={14} className={`transition-transform ${isGuideOpen ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {isGuideOpen && (
                  <div className="mb-4 bg-kage-bg rounded-xl p-4 border border-kage-border animate-slide-up">
                    <ol className="space-y-2">
                      {steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-kage-primary/20 text-kage-primary text-[11px] font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-kage-text">{s}</span>
                        </li>
                      ))}
                    </ol>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs text-kage-primary hover:text-kage-primary/80"
                    >
                      <ExternalLink size={12} />
                      {provider.docsUrl}
                    </a>
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={key}
                      onChange={(e) => setApiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                      placeholder={provider.placeholder}
                      className="kage-input w-full pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys(prev => ({ ...prev, [provider.id]: !showKey }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-kage-sub hover:text-kage-text"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => testApiKey(provider.id)}
                      disabled={!key.trim() || isTesting}
                      className="kage-btn-ghost text-xs border border-kage-border px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      {isJa ? '接続テスト' : 'Test Connection'}
                    </button>
                    {result && (
                      <span className={`text-xs flex items-center gap-1 ${result.success ? 'text-kage-success' : 'text-kage-danger'}`}>
                        {result.success ? (
                          <><CheckCircle size={14} /> {isJa ? '接続成功' : 'Connected'} ({result.latency_ms}ms)</>
                        ) : (
                          <><XCircle size={14} /> {result.error?.substring(0, 50)}</>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => setStep(step - 1)} className="kage-btn-ghost text-sm flex-1 border border-kage-border">
                    {isJa ? '戻る' : 'Back'}
                  </button>
                  {!provider.required && !key.trim() && (
                    <button onClick={() => setStep(step + 1)} className="kage-btn-ghost text-sm flex-1 border border-kage-border text-kage-sub">
                      {isJa ? 'スキップ' : 'Skip'}
                    </button>
                  )}
                  <button
                    onClick={() => setStep(step + 1)}
                    disabled={provider.required && !key.trim()}
                    className="kage-btn-primary text-sm flex-1 disabled:opacity-40"
                  >
                    {isJa ? '次へ' : 'Next'}
                  </button>
                </div>

                <p className="text-center text-[10px] text-kage-sub mt-4">
                  {isJa ? `プロバイダー ${currentProviderIdx + 1} / ${PROVIDERS.length}` : `Provider ${currentProviderIdx + 1} of ${PROVIDERS.length}`}
                  {' · '}
                  {isJa ? `${configuredCount}個設定済み` : `${configuredCount} configured`}
                </p>
              </div>
            );
          })()}

          {/* ───── Security Level ───── */}
          {isSecurityStep && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-kage-primary/10 flex items-center justify-center">
                  <ShieldCheck size={20} className="text-kage-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-kage-text">
                    {isJa ? 'セキュリティレベル' : 'Security Level'}
                  </h2>
                  <p className="text-xs text-kage-sub">
                    {isJa ? 'エージェントの権限レベルを選択' : 'Choose agent permission level'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {[
                  {
                    id: 'strict',
                    icon: '🔒',
                    title: isJa ? 'Strict（厳格）' : 'Strict',
                    desc: isJa ? '全ての操作に承認が必要。企業や機密データ向け' : 'All operations require approval. For enterprise & sensitive data',
                  },
                  {
                    id: 'balanced',
                    icon: '⚖️',
                    title: isJa ? 'Balanced（バランス）' : 'Balanced',
                    desc: isJa ? '読み取りは自動、書き込み・外部APIは承認が必要。推奨' : 'Reads auto-approved, writes & external APIs need approval. Recommended',
                    recommended: true,
                  },
                  {
                    id: 'relaxed',
                    icon: '🚀',
                    title: isJa ? 'Relaxed（緩和）' : 'Relaxed',
                    desc: isJa ? 'ほぼ全て自動承認。個人利用・開発環境向け' : 'Most operations auto-approved. For personal use & dev environments',
                  },
                ].map((level) => (
                  <button
                    key={level.id}
                    onClick={() => setSecurityLevel(level.id)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all ${
                      securityLevel === level.id
                        ? 'border-kage-primary bg-kage-primary/10'
                        : 'border-kage-border hover:border-kage-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{level.icon}</span>
                      <span className="text-sm font-semibold text-kage-text">{level.title}</span>
                      {level.recommended && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-kage-primary/20 text-kage-primary font-semibold">
                          {isJa ? '推奨' : 'Recommended'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-kage-sub mt-1 ml-8">{level.desc}</p>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep(step - 1)} className="kage-btn-ghost text-sm flex-1 border border-kage-border">
                  {isJa ? '戻る' : 'Back'}
                </button>
                <button onClick={() => setStep(step + 1)} className="kage-btn-primary text-sm flex-1">
                  {isJa ? '次へ' : 'Next'}
                </button>
              </div>
            </div>
          )}

          {/* ───── Done ───── */}
          {isDoneStep && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-3xl bg-kage-success/10 flex items-center justify-center mx-auto mb-5">
                <Sparkles size={36} className="text-kage-success" />
              </div>
              <h2 className="text-2xl font-bold text-kage-text mb-2">
                {isJa ? 'セットアップ完了！' : 'Setup Complete!'}
              </h2>
              <p className="text-sm text-kage-sub mb-4">
                {isJa ? 'KAGEの準備ができました' : 'KAGE is ready to use'}
              </p>

              <div className="bg-kage-bg rounded-xl p-4 mb-6 text-left space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-kage-sub">{isJa ? 'AIモデル' : 'AI Models'}</span>
                  <span className="text-kage-text font-semibold">{configuredCount} {isJa ? 'プロバイダー' : 'providers'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-kage-sub">{isJa ? 'セキュリティ' : 'Security'}</span>
                  <span className="text-kage-text font-semibold capitalize">{securityLevel}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-kage-sub">{isJa ? '連携可能' : 'Integrations'}</span>
                  <span className="text-kage-text font-semibold">67+ apps</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-kage-border mt-2">
                  {PROVIDERS.filter(p => apiKeys[p.id]?.trim()).map(p => (
                    <span key={p.id} className="text-[11px] px-2 py-1 rounded-full bg-kage-success/10 text-kage-success flex items-center gap-1">
                      <CheckCircle size={10} /> {p.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>

              {saveError && (
                <p className="text-xs text-kage-danger mb-3 flex items-center justify-center gap-1">
                  <XCircle size={12} /> {saveError}
                </p>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(step - 1)} className="kage-btn-ghost text-sm flex-1 border border-kage-border">
                  {isJa ? '戻る' : 'Back'}
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="kage-btn-primary text-sm flex-1 py-3"
                >
                  {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : (isJa ? 'KAGEを起動' : 'Launch KAGE')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
