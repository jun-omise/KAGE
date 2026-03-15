import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, ListTodo, Wrench, ShieldCheck,
  Settings, Menu, X, Shield, ChevronLeft, ChevronRight,
  Bell, MessageCircle,
} from 'lucide-react';
import { useI18n } from './i18n/index.jsx';
import { useChat } from './hooks/useChat';
import { useSSE } from './hooks/useSSE';
import { useAgentState } from './hooks/useAgentState';
import Sidebar from './components/Sidebar';
import ChatPanel from './components/ChatPanel';
import AgentMonitor from './components/AgentMonitor';
import ApprovalDialog from './components/ApprovalDialog';
import SecurityPanel from './components/SecurityPanel';
import TaskBuilder from './components/TaskBuilder';
import ToolManager from './components/ToolManager';
import ModelSelector from './components/ModelSelector';
import SetupWizard from './components/SetupWizard';
import NotificationSettings from './components/NotificationSettings';
import MessagingConfig from './components/MessagingConfig';

const NAV_ITEMS = [
  { key: 'chat', icon: MessageSquare },
  { key: 'tasks', icon: ListTodo },
  { key: 'tools', icon: Wrench },
  { key: 'notifications', icon: Bell },
  { key: 'messaging', icon: MessageCircle },
  { key: 'security', icon: ShieldCheck },
];

function useWindowSize() {
  const [size, setSize] = useState({ width: window.innerWidth });
  useEffect(() => {
    const handler = () => setSize({ width: window.innerWidth });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return size;
}

function LoginScreen({ onLogin }) {
  const { t } = useI18n();
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Authentication failed');
      }
      const data = await res.json();
      onLogin(data.token);
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

export default function App() {
  const { t } = useI18n();
  const { width } = useWindowSize();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1280;
  const isDesktop = width >= 1280;

  const [currentView, setCurrentView] = useState('chat');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [monitorCollapsed, setMonitorCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');
  const [showMonitorOverlay, setShowMonitorOverlay] = useState(false);

  const {
    messages,
    conversations,
    isLoading,
    sendMessage,
    loadConversation,
    loadConversations,
    createConversation,
    deleteConversation,
  } = useChat();

  const {
    agentStates,
    cost: sseCost,
    approval,
    isConnected,
    isPaused: sseIsPaused,
    pipelineProgress,
    subtaskProgress,
    fileResults,
    clearApproval,
    clearFileResults,
  } = useSSE(selectedConversation);

  const { agents, cost, elapsed, toolsUsed, isPaused } = useAgentState(
    agentStates,
    sseCost,
    sseIsPaused
  );

  useEffect(() => {
    // Check if setup has been completed
    fetch('/api/auth/status')
      .then((res) => res.json())
      .then((data) => {
        if (!data.setup) {
          setShowSetup(true);
        } else {
          const token = localStorage.getItem('kage_token');
          if (token) {
            setIsAuthenticated(true);
          }
        }
      })
      .catch(() => {
        const token = localStorage.getItem('kage_token');
        if (token) setIsAuthenticated(true);
      });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
    }
  }, [isAuthenticated, loadConversations]);

  const handleLogin = useCallback((token) => {
    localStorage.setItem('kage_token', token);
    setIsAuthenticated(true);
  }, []);

  const handleSetupComplete = useCallback(() => {
    setShowSetup(false);
    setIsAuthenticated(true);
  }, []);

  const handleSelectConversation = useCallback((id) => {
    setSelectedConversation(id);
    loadConversation(id);
    if (isMobile) setMobileTab('chat');
  }, [loadConversation, isMobile]);

  const handleNewConversation = useCallback(async () => {
    const id = await createConversation();
    if (id) {
      setSelectedConversation(id);
      if (isMobile) setMobileTab('chat');
    }
  }, [createConversation, isMobile]);

  const handleDeleteConversation = useCallback((id) => {
    deleteConversation(id);
    if (selectedConversation === id) {
      setSelectedConversation(null);
    }
  }, [deleteConversation, selectedConversation]);

  const handleSendMessage = useCallback(async (text) => {
    let convId = selectedConversation;
    if (!convId) {
      convId = await createConversation();
      if (convId) setSelectedConversation(convId);
    }
    if (convId) {
      sendMessage(text, convId, {
        getFileResults: () => fileResults,
        clearFileResults,
      });
    }
  }, [selectedConversation, sendMessage, createConversation, fileResults, clearFileResults]);

  const handleApprove = useCallback(async (id, autoApprove) => {
    try {
      await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'approve', autoApprove }),
      });
      clearApproval();
    } catch {
      // handle error
    }
  }, [clearApproval]);

  const handleReject = useCallback(async (id) => {
    try {
      await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'reject' }),
      });
      clearApproval();
    } catch {
      // handle error
    }
  }, [clearApproval]);

  const handleModify = useCallback(async (id) => {
    try {
      await fetch('/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'modify' }),
      });
      clearApproval();
    } catch {
      // handle error
    }
  }, [clearApproval]);

  const handlePause = useCallback(async () => {
    try {
      await fetch('/api/agents/pause', { method: 'POST' });
    } catch {
      // handle error
    }
  }, []);

  const handleResume = useCallback(async () => {
    try {
      await fetch('/api/agents/resume', { method: 'POST' });
    } catch {
      // handle error
    }
  }, []);

  const handleStop = useCallback(async () => {
    try {
      await fetch('/api/agents/stop', { method: 'POST' });
    } catch {
      // handle error
    }
  }, []);

  // First time setup
  if (showSetup) {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-kage-bg">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-kage-border bg-kage-card">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-kage-primary" />
            <span className="text-base font-bold text-kage-text">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1">
            {isConnected && (
              <span className="w-2 h-2 rounded-full bg-kage-success" />
            )}
            <button className="p-2 rounded-lg hover:bg-white/5 text-kage-sub">
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {mobileTab === 'sidebar' && (
            <div className="h-full overflow-y-auto bg-kage-card">
              <div className="px-3 py-3">
                <button
                  onClick={handleNewConversation}
                  className="kage-btn-primary w-full flex items-center justify-center gap-2 text-sm"
                >
                  {t('chat.newConversation')}
                </button>
              </div>
              <div className="px-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                      conv.id === selectedConversation ? 'bg-kage-primary/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-sm text-kage-text truncate block">{conv.title || t('chat.newConversation')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {mobileTab === 'chat' && (
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              pipelineProgress={pipelineProgress}
              subtaskProgress={subtaskProgress}
            />
          )}
          {mobileTab === 'monitor' && (
            <div className="h-full overflow-y-auto">
              <AgentMonitor
                agents={agents}
                cost={cost}
                elapsed={elapsed}
                toolsUsed={toolsUsed}
                isPaused={isPaused}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                collapsed={false}
                onToggleCollapse={() => setMobileTab('chat')}
              pipelineProgress={pipelineProgress}
              subtaskProgress={subtaskProgress}
              />
            </div>
          )}
        </div>

        {/* Bottom tabs */}
        <nav className="flex border-t border-kage-border bg-kage-card">
          {[
            { key: 'sidebar', icon: Menu, label: t('chat.newConversation') },
            { key: 'chat', icon: MessageSquare, label: 'Chat' },
            { key: 'monitor', icon: ShieldCheck, label: t('agents.monitor') },
          ].map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setMobileTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                mobileTab === key ? 'text-kage-primary' : 'text-kage-sub'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}
        </nav>

        {/* Approval dialog */}
        <ApprovalDialog
          approval={approval}
          onApprove={handleApprove}
          onReject={handleReject}
          onModify={handleModify}
        />
      </div>
    );
  }

  // Desktop / Tablet layout
  return (
    <div className="h-screen flex flex-col bg-kage-bg">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-kage-border bg-kage-card flex-shrink-0">
        <div className="flex items-center gap-4">
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-kage-primary" />
            <span className="text-lg font-bold text-kage-text tracking-wide">{t('app.name')}</span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1 ml-4">
            {NAV_ITEMS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setCurrentView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                  currentView === key
                    ? 'bg-kage-primary/10 text-kage-primary font-medium'
                    : 'text-kage-sub hover:text-kage-text hover:bg-white/5'
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{
                  key === 'chat' ? 'Chat'
                  : key === 'tasks' ? t('tasks.title')
                  : key === 'tools' ? t('tools.title')
                  : key === 'notifications' ? t('notifications.title')
                  : key === 'messaging' ? t('messaging.title')
                  : t('security.title')
                }</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ModelSelector compact />
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-kage-success">
              <span className="w-1.5 h-1.5 rounded-full bg-kage-success animate-pulse-glow" />
              SSE
            </span>
          )}
          {monitorCollapsed && isDesktop && (
            <button
              onClick={() => setMonitorCollapsed(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <button className="p-2 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          conversations={conversations}
          activeConversationId={selectedConversation}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {currentView === 'chat' && (
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              pipelineProgress={pipelineProgress}
              subtaskProgress={subtaskProgress}
            />
          )}
          {currentView === 'tasks' && <TaskBuilder />}
          {currentView === 'tools' && <ToolManager />}
          {currentView === 'notifications' && <NotificationSettings />}
          {currentView === 'messaging' && <MessagingConfig />}
          {currentView === 'security' && <SecurityPanel />}
        </main>

        {/* Agent Monitor -- desktop: inline column, tablet: overlay */}
        {isDesktop && (
          <AgentMonitor
            agents={agents}
            cost={cost}
            elapsed={elapsed}
            toolsUsed={toolsUsed}
            isPaused={isPaused}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            collapsed={monitorCollapsed}
            onToggleCollapse={() => setMonitorCollapsed(!monitorCollapsed)}
            pipelineProgress={pipelineProgress}
            subtaskProgress={subtaskProgress}
          />
        )}

        {isTablet && showMonitorOverlay && (
          <div className="fixed inset-y-0 right-0 z-40 flex">
            <div
              className="w-screen bg-black/40"
              onClick={() => setShowMonitorOverlay(false)}
            />
            <div className="relative">
              <AgentMonitor
                agents={agents}
                cost={cost}
                elapsed={elapsed}
                toolsUsed={toolsUsed}
                isPaused={isPaused}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                collapsed={false}
                onToggleCollapse={() => setShowMonitorOverlay(false)}
                pipelineProgress={pipelineProgress}
                subtaskProgress={subtaskProgress}
              />
            </div>
          </div>
        )}

        {isTablet && !showMonitorOverlay && (
          <button
            onClick={() => setShowMonitorOverlay(true)}
            className="fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-kage-primary text-white shadow-lg
                       flex items-center justify-center hover:bg-kage-primary/80 transition-colors"
            title={t('agents.monitor')}
          >
            <ShieldCheck size={20} />
          </button>
        )}
      </div>

      {/* Approval dialog */}
      <ApprovalDialog
        approval={approval}
        onApprove={handleApprove}
        onReject={handleReject}
        onModify={handleModify}
      />
    </div>
  );
}
