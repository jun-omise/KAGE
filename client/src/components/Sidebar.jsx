import React from 'react';
import { Plus, ChevronLeft, Shield } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import ConversationList from './ConversationList';

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  collapsed,
  onToggleCollapse,
}) {
  const { t } = useI18n();

  return (
    <aside
      className={`flex flex-col h-full bg-kage-card border-r border-kage-border transition-all duration-300
        ${collapsed ? 'w-0 overflow-hidden' : 'w-[280px]'}`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-kage-border">
        <div className="flex items-center gap-2">
          <Shield size={24} className="text-kage-primary" />
          <span className="text-lg font-bold text-kage-text tracking-wide">
            {t('app.name')}
          </span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* New Conversation */}
      <div className="px-3 py-3">
        <button
          onClick={onNewConversation}
          className="kage-btn-primary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={16} />
          {t('chat.newConversation')}
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        <ConversationList
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onDelete={onDeleteConversation}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-kage-border">
        <p className="text-xs text-kage-sub text-center">
          {t('app.tagline')}
        </p>
      </div>
    </aside>
  );
}
