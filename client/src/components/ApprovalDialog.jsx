import React, { useState, useCallback } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Edit3, AlertTriangle, DollarSign, Wrench } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

const RISK_COLORS = {
  low: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', label: 'Low Risk' },
  medium: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400', label: 'Medium Risk' },
  high: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', label: 'High Risk' },
};

export default function ApprovalDialog({ approval, onApprove, onReject, onModify }) {
  const { t } = useI18n();
  const [autoApprove, setAutoApprove] = useState(false);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleApprove = useCallback(() => {
    onApprove(approval.id, autoApprove);
  }, [approval?.id, autoApprove, onApprove]);

  const handleReject = useCallback(() => {
    onReject(approval.id, rejectReason || undefined);
    setShowRejectReason(false);
    setRejectReason('');
  }, [approval?.id, rejectReason, onReject]);

  if (!approval) return null;

  const risk = RISK_COLORS[approval.riskLevel] || RISK_COLORS.medium;
  const argsPreview = approval.argsPreview || approval.args_preview;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div className={`relative max-w-lg w-full mx-4 animate-slide-up rounded-xl overflow-hidden border ${risk.border} bg-kage-card shadow-2xl`}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-kage-border/30">
          <div className="w-9 h-9 rounded-lg bg-kage-warning/10 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={18} className="text-kage-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-kage-text">
              {t('approval.title')}
            </h3>
            {approval.agent && (
              <p className="text-[11px] text-kage-sub capitalize">{approval.agent}</p>
            )}
          </div>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${risk.bg} ${risk.text} font-medium`}>
            {risk.label}
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-3.5 space-y-3">
          {/* Action - code block style */}
          <div className="rounded-lg border border-kage-border/30 bg-[#1a1b26] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16171f] border-b border-kage-border/20">
              <span className="text-[10px] text-kage-sub">{t('approval.action')}</span>
            </div>
            <div className="px-3 py-2">
              <div className="text-sm text-kage-text">
                {approval.description || approval.action || 'Unknown action'}
              </div>
              {approval.tool && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Wrench size={11} className="text-kage-primary" />
                  <span className="text-xs text-kage-primary font-mono">{approval.tool}</span>
                </div>
              )}
            </div>
          </div>

          {/* Permissions required */}
          {approval.permissions && approval.permissions.length > 0 && (
            <div className="rounded-lg border border-kage-border/30 bg-[#1a1b26] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16171f] border-b border-kage-border/20">
                <span className="text-[10px] text-kage-sub">{t('approval.permission')}</span>
              </div>
              <div className="px-3 py-2 flex flex-wrap gap-1.5">
                {approval.permissions.map((perm, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 font-mono">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Content preview */}
          {argsPreview && (
            <div className="rounded-lg border border-kage-border/30 bg-[#1a1b26] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16171f] border-b border-kage-border/20">
                <span className="text-[10px] text-kage-sub">Preview</span>
              </div>
              <pre className="px-3 py-2 text-[11px] text-kage-sub whitespace-pre-wrap break-all font-mono max-h-32 overflow-y-auto">
                {typeof argsPreview === 'string' ? argsPreview : JSON.stringify(argsPreview, null, 2)}
              </pre>
            </div>
          )}

          {/* Cost */}
          {(approval.estimatedCost > 0 || approval.estimated_cost > 0) && (
            <div className="flex items-center gap-1 text-xs text-kage-sub">
              <DollarSign size={12} />
              <span>{t('approval.cost')}: +${(approval.estimatedCost || approval.estimated_cost || 0).toFixed(4)}</span>
            </div>
          )}

          {/* Auto-approve */}
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-kage-border bg-kage-bg text-kage-primary focus:ring-kage-primary focus:ring-offset-0"
            />
            <span className="text-xs text-kage-sub group-hover:text-kage-text transition-colors">
              {t('approval.autoApprove')}
            </span>
          </label>

          {/* Reject reason */}
          {showRejectReason && (
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={2}
              className="kage-input w-full text-xs resize-none"
              autoFocus
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-5 py-3 border-t border-kage-border/30 bg-[#16171f]/50">
          {showRejectReason ? (
            <>
              <button
                onClick={() => setShowRejectReason(false)}
                className="flex-1 kage-btn-ghost text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleReject}
                className="flex-1 kage-btn-danger text-sm flex items-center justify-center gap-1.5"
              >
                <XCircle size={14} />
                {t('approval.reject')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleApprove}
                className="flex-1 kage-btn bg-kage-success hover:bg-kage-success/80 text-white text-sm flex items-center justify-center gap-1.5"
              >
                <CheckCircle size={14} />
                {t('approval.approve')}
              </button>
              <button
                onClick={() => setShowRejectReason(true)}
                className="flex-1 kage-btn-danger text-sm flex items-center justify-center gap-1.5"
              >
                <XCircle size={14} />
                {t('approval.reject')}
              </button>
              {onModify && (
                <button
                  onClick={() => onModify(approval.id)}
                  className="flex-1 kage-btn bg-kage-warning hover:bg-kage-warning/80 text-white text-sm flex items-center justify-center gap-1.5"
                >
                  <Edit3 size={14} />
                  {t('approval.modify')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
