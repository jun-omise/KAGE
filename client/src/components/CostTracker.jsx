import React from 'react';
import { DollarSign } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

export default function CostTracker({ current, limit }) {
  const { t } = useI18n();
  const percentage = limit > 0 ? (current / limit) * 100 : 0;
  const isWarning = percentage > 80;
  const isDanger = percentage > 95;

  const barColor = isDanger
    ? 'bg-kage-danger'
    : isWarning
      ? 'bg-kage-warning'
      : 'bg-kage-primary';

  const textColor = isDanger
    ? 'text-kage-danger'
    : isWarning
      ? 'text-kage-warning'
      : 'text-kage-text';

  return (
    <div className="kage-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <DollarSign size={14} className="text-kage-sub" />
          <span className="text-xs font-medium text-kage-sub">{t('agents.cost')}</span>
        </div>
        <span className={`text-sm font-mono font-medium ${textColor}`}>
          ${current.toFixed(4)} / ${limit.toFixed(2)}
        </span>
      </div>
      <div className="w-full h-1.5 bg-kage-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {isWarning && (
        <p className={`text-xs mt-1.5 ${isDanger ? 'text-kage-danger' : 'text-kage-warning'}`}>
          {isDanger ? '! ' : ''}{percentage.toFixed(0)}%
        </p>
      )}
    </div>
  );
}
