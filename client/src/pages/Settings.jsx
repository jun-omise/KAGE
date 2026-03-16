/**
 * Settings page — unified settings including model, notifications, messaging
 */
import { useState } from 'react';
import { Settings as SettingsIcon, Bell, MessageCircle, Brain } from 'lucide-react';
import { useI18n } from '../i18n/index.jsx';
import ModelSelector from '../components/ModelSelector.jsx';
import NotificationSettings from '../components/NotificationSettings.jsx';
import MessagingConfig from '../components/MessagingConfig.jsx';

const TABS = [
  { key: 'model', icon: Brain },
  { key: 'notifications', icon: Bell },
  { key: 'messaging', icon: MessageCircle },
];

export default function Settings() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('model');

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={20} className="text-kage-primary" />
          <h2 className="text-lg font-bold text-kage-text">Settings</h2>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 border-b border-kage-border">
          {TABS.map(({ key, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b-2 ${
                activeTab === key
                  ? 'border-kage-primary text-kage-primary'
                  : 'border-transparent text-kage-sub hover:text-kage-text'
              }`}
            >
              <Icon size={16} />
              <span>
                {key === 'model' ? 'Model' :
                 key === 'notifications' ? t('notifications.title') :
                 t('messaging.title')}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'model' && <ModelSelector />}
        {activeTab === 'notifications' && <NotificationSettings />}
        {activeTab === 'messaging' && <MessagingConfig />}
      </div>
    </div>
  );
}
