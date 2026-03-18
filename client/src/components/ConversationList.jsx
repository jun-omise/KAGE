import React from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';

function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export default function ConversationList({ conversations, activeId, onSelect, onDelete }) {
  const { t } = useI18n();

  if (!conversations || conversations.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-kage-sub text-sm">
        {t('chat.noMessages')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-2">
      {conversations.map((conv) => {
        const isActive = conv.id === activeId;
        return (
          <div
            key={conv.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(conv.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(conv.id); }}
            className={`group relative w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer
              ${isActive
                ? 'bg-kage-primary/10 border border-kage-primary/30'
                : 'hover:bg-white/5 border border-transparent'
              }`}
          >
            <div className="flex items-start gap-2.5">
              <MessageSquare
                size={16}
                className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-kage-primary' : 'text-kage-sub'}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium truncate ${isActive ? 'text-kage-text' : 'text-kage-sub'}`}>
                    {conv.title || t('chat.newConversation')}
                  </span>
                  <span className="text-xs text-kage-sub flex-shrink-0">
                    {formatTime(conv.updatedAt || conv.createdAt)}
                  </span>
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-kage-sub truncate mt-0.5">
                    {conv.lastMessage}
                  </p>
                )}
                {conv.messageCount > 0 && (
                  <span className="text-xs text-kage-sub/60 mt-0.5">
                    {conv.messageCount} messages
                  </span>
                )}
              </div>
            </div>

            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                           p-1 rounded hover:bg-kage-danger/20 text-kage-sub hover:text-kage-danger"
                title={t('chat.deleteConversation')}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
