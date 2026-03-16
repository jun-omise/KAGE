import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, clearToken, hasToken } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    setupComplete: false,
  });

  const checkAuth = useCallback(async () => {
    try {
      const status = await api.get('/auth/status');
      const hasExistingToken = hasToken();

      setAuthState({
        loading: false,
        authenticated: hasExistingToken,
        setupComplete: !!status.setup,
      });
    } catch {
      // Server not reachable — check if we have a token
      setAuthState({
        loading: false,
        authenticated: hasToken(),
        setupComplete: true, // Assume setup done if server unreachable
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen for auth expiration events from api.js
    const handleExpired = () => {
      setAuthState(prev => ({ ...prev, authenticated: false }));
    };
    window.addEventListener('kage:auth:expired', handleExpired);
    return () => window.removeEventListener('kage:auth:expired', handleExpired);
  }, [checkAuth]);

  const login = useCallback(async (passphrase) => {
    const data = await api.post('/auth/login', { passphrase });
    setToken(data.token);
    setAuthState(prev => ({ ...prev, authenticated: true }));
    return data;
  }, []);

  const setup = useCallback(async (passphrase, apiKey, securityLevel) => {
    const data = await api.post('/auth/setup', { passphrase, apiKey, securityLevel });
    setToken(data.token);
    setAuthState(prev => ({
      ...prev,
      authenticated: true,
      setupComplete: true,
    }));
    return data;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthState(prev => ({ ...prev, authenticated: false }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...authState, login, setup, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
