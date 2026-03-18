/**
 * Toast notification system — success/error/warning toasts.
 * Renders in bottom-right corner, auto-dismisses after 3 seconds.
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

const ICONS = {
  success: { icon: CheckCircle, color: 'text-kage-success', border: 'border-kage-success/30', bg: 'bg-kage-success/5' },
  error: { icon: XCircle, color: 'text-kage-danger', border: 'border-kage-danger/30', bg: 'bg-kage-danger/5' },
  warning: { icon: AlertTriangle, color: 'text-kage-warning', border: 'border-kage-warning/30', bg: 'bg-kage-warning/5' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    timersRef.current[id] = setTimeout(() => {
      removeToast(id);
      delete timersRef.current[id];
    }, duration);
    return id;
  }, [removeToast]);

  const toast = useCallback({
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
  }, [addToast]);

  // Fix: can't use useCallback on an object, restructure
  const value = {
    toast: {
      success: (msg) => addToast(msg, 'success'),
      error: (msg) => addToast(msg, 'error'),
      warning: (msg) => addToast(msg, 'warning'),
    },
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => {
          const style = ICONS[t.type] || ICONS.success;
          const Icon = style.icon;
          return (
            <div
              key={t.id}
              className={`${t.exiting ? 'toast-exit' : 'toast-enter'} kage-card ${style.bg} border ${style.border} px-4 py-3 flex items-start gap-3 shadow-lg`}
            >
              <Icon size={16} className={`${style.color} flex-shrink-0 mt-0.5`} />
              <span className="text-sm text-kage-text flex-1">{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                className="text-kage-sub hover:text-kage-text flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}
