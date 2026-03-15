import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

export default function ApprovalDialog({ approval, onApprove, onReject, onModify }) {
  const { t } = useI18n();
  const [autoApprove, setAutoApprove] = useState(false);

  if (!approval) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative kage-card p-6 max-w-md w-full mx-4 animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-kage-warning/10 flex items-center justify-center">
            <ShieldAlert size={20} className="text-kage-warning" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-kage-text">
              {t('approval.title')}
            </h3>
            {approval.agent && (
              <p className="text-xs text-kage-sub">{t(`agents.${approval.agent}`)}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-3 mb-5">
          <div className="bg-kage-bg rounded-lg p-3">
            <div className="text-xs text-kage-sub mb-1">{t('approval.action')}</div>
            <div className="text-sm text-kage-text font-medium">
              {approval.description || approval.action || 'Unknown action'}
            </div>
            {approval.tool && (
              <div className="text-xs text-kage-primary mt-1 font-mono">{approval.tool}</div>
            )}
          </div>

          {approval.permissions && approval.permissions.length > 0 && (
            <div className="bg-kage-bg rounded-lg p-3">
              <div className="text-xs text-kage-sub mb-1">{t('approval.permission')}</div>
              <div className="flex flex-wrap gap-1.5">
                {approval.permissions.map((perm, i) => (
                  <span key={i} className="kage-badge-warning">{perm}</span>
                ))}
              </div>
            </div>
          )}

          {approval.estimatedCost > 0 && (
            <div className="bg-kage-bg rounded-lg p-3">
              <div className="text-xs text-kage-sub mb-1">{t('approval.cost')}</div>
              <div className="text-sm text-kage-warning font-mono">
                ${approval.estimatedCost.toFixed(4)}
              </div>
            </div>
          )}
        </div>

        {/* Auto-approve checkbox */}
        <label className="flex items-center gap-2 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="w-4 h-4 rounded border-kage-border bg-kage-bg text-kage-primary focus:ring-kage-primary focus:ring-offset-0"
          />
          <span className="text-xs text-kage-sub">{t('approval.autoApprove')}</span>
        </label>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(approval.id, autoApprove)}
            className="flex-1 kage-btn bg-kage-success hover:bg-kage-success/80 text-white text-sm"
          >
            {t('approval.approve')}
          </button>
          <button
            onClick={() => onReject(approval.id)}
            className="flex-1 kage-btn-danger text-sm"
          >
            {t('approval.reject')}
          </button>
          <button
            onClick={() => onModify(approval.id)}
            className="flex-1 kage-btn bg-kage-warning hover:bg-kage-warning/80 text-white text-sm"
          >
            {t('approval.modify')}
          </button>
        </div>
      </div>
    </div>
  );
}
