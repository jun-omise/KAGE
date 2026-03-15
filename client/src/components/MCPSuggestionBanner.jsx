import React, { useState } from 'react';
import { X, Loader2, Check, Plug } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

export default function MCPSuggestionBanner({ suggestions, onConnect, onDismiss }) {
  const { t } = useI18n();
  const [connecting, setConnecting] = useState(new Set());
  const [connected, setConnected] = useState(new Set());

  if (!suggestions || suggestions.length === 0) return null;

  const handleConnect = async (serverId) => {
    setConnecting(prev => new Set([...prev, serverId]));
    const success = await onConnect(serverId);
    setConnecting(prev => {
      const next = new Set(prev);
      next.delete(serverId);
      return next;
    });
    if (success) {
      setConnected(prev => new Set([...prev, serverId]));
    }
  };

  return (
    <div className="animate-slide-up bg-kage-card/80 border border-kage-border rounded-lg px-3 py-2 mb-2">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs text-kage-sub">
          <Plug size={12} className="text-kage-primary" />
          <span>{t('suggestions.mcpNeeded')}</span>
        </div>
        <button
          onClick={onDismiss}
          className="p-0.5 rounded hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => {
          const isConnecting = connecting.has(s.serverId);
          const isConnected = connected.has(s.serverId) || s.connected;

          return (
            <button
              key={s.serverId}
              onClick={() => !isConnected && !isConnecting && handleConnect(s.serverId)}
              disabled={isConnected || isConnecting}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-all ${
                isConnected
                  ? 'bg-kage-success/10 text-kage-success cursor-default'
                  : isConnecting
                  ? 'bg-kage-primary/10 text-kage-primary cursor-wait'
                  : 'bg-kage-bg hover:bg-kage-primary/10 text-kage-text hover:text-kage-primary cursor-pointer border border-kage-border hover:border-kage-primary/30'
              }`}
              title={s.description}
            >
              <span>{s.icon}</span>
              <span className="font-medium">{s.serverName}</span>
              {isConnecting && <Loader2 size={10} className="animate-spin" />}
              {isConnected && <Check size={10} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
