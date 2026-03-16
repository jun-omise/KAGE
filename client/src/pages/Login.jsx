import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { t } = useI18n();
  const { login } = useAuth();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    setLoading(true);
    setError('');
    try {
      await login(passphrase);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-kage-bg flex items-center justify-center px-4">
      <div className="kage-card p-8 max-w-sm w-full animate-slide-up">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-kage-primary/10 flex items-center justify-center mb-3">
            <Shield size={28} className="text-kage-primary" />
          </div>
          <h1 className="text-2xl font-bold text-kage-text">{t('app.name')}</h1>
          <p className="text-sm text-kage-sub mt-1">{t('app.tagline')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder={t('setup.passphrase')}
            className="kage-input w-full"
            autoFocus
          />
          {error && (
            <p className="text-xs text-kage-danger">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !passphrase.trim()}
            className="kage-btn-primary w-full disabled:opacity-40"
          >
            {loading ? t('common.loading') : t('setup.confirm')}
          </button>
        </form>
      </div>
    </div>
  );
}
