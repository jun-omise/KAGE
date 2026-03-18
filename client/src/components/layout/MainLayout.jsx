/**
 * MainLayout — authenticated layout with top bar, sidebar, main content, and agent monitor.
 * Extracted from App.jsx for Phase 0 compliance.
 * Supports mobile / tablet / desktop breakpoints.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, ListTodo, Wrench, ShieldCheck,
  Settings, Menu, Shield, ChevronLeft, ChevronRight,
  Bell, MessageCircle, Layers,
} from 'lucide-react';
import { useI18n } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useChat } from '../../hooks/useChat';
import { useSSE } from '../../hooks/useSSE';
import { useAgentState } from '../../hooks/useAgentState';
import Sidebar from '../Sidebar';
import ChatPanel from '../ChatPanel';
import AgentMonitor from '../AgentMonitor';
import ApprovalDialog from '../ApprovalDialog';
import SecurityPanel from '../SecurityPanel';
import TaskBuilder from '../TaskBuilder';
import ToolManager from '../ToolManager';
import ModelSelector from '../ModelSelector';
import NotificationSettings from '../NotificationSettings';
import MessagingConfig from '../MessagingConfig';
import TaskDashboard from '../TaskDashboard';
import SettingsPage from '../../pages/Settings';

const NAV_ITEMS = [
  { key: 'chat', icon: MessageSquare },
  { key: 'queue', icon: Layers },
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

export default function MainLayout() {
  const { t } = useI18n();
  const { logout } = useAuth();
  const { width } = useWindowSize();

  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1280;
  const isDesktop = width >= 1280;

  const [currentView, setCurrentView] = useState('chat');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [monitorCollapsed, setMonitorCollapsed] = useState(false);
  const [mobileTab, setMobileTab] = useState('chat');
  const [showMonitorOverlay, setShowMonitorOverlay] = useState(false);

  const {
    messages, conversations, isLoading, streamingText,
    sendMessage, loadConversation, loadConversations,
    createConversation, deleteConversation,
    appendStreamingChunk, clearStreaming,
  } = useChat();

  const {
    agentStates, cost: sseCost, approval, isConnected,
    isPaused: sseIsPaused, pipelineProgress, subtaskProgress,
    fileResults, clearApproval, clearFileResults,
  } = useSSE(selectedConversation, { onResponseChunk: appendStreamingChunk });

  const { agents, cost, elapsed, toolsUsed, isPaused } = useAgentState(
    agentStates, sseCost, sseIsPaused
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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
    if (selectedConversation === id) setSelectedConversation(null);
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
      await fetch(`/api/approval/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoApprove }),
      });
      clearApproval();
    } catch { /* */ }
  }, [clearApproval]);

  const handleReject = useCallback(async (id, reason) => {
    try {
      await fetch(`/api/approval/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      clearApproval();
    } catch { /* */ }
  }, [clearApproval]);

  const handleModify = useCallback(async (id) => {
    try {
      await fetch(`/api/approval/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Modified by user' }),
      });
      clearApproval();
    } catch { /* */ }
  }, [clearApproval]);

  const handlePause = useCallback(async () => {
    try { await fetch('/api/agents/pause', { method: 'POST' }); } catch { /* */ }
  }, []);

  const handleResume = useCallback(async () => {
    try { await fetch('/api/agents/resume', { method: 'POST' }); } catch { /* */ }
  }, []);

  const handleStop = useCallback(async () => {
    try { await fetch('/api/agents/stop', { method: 'POST' }); } catch { /* */ }
  }, []);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-screen flex flex-col bg-kage-bg">
        <header className="flex items-center justify-between px-4 py-3 border-b border-kage-border bg-kage-card">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-kage-primary" />
            <span className="text-base font-bold text-kage-text">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1">
            {isConnected && <span className="w-2 h-2 rounded-full bg-kage-success" />}
            <button className="p-2 rounded-lg hover:bg-white/5 text-kage-sub">
              <Settings size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {mobileTab === 'sidebar' && (
            <div className="h-full overflow-y-auto bg-kage-card">
              <div className="px-3 py-3">
                <button onClick={handleNewConversation} className="kage-btn-primary w-full flex items-center justify-center gap-2 text-sm">
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
            <ChatPanel messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage}
              pipelineProgress={pipelineProgress} subtaskProgress={subtaskProgress} streamingText={streamingText}
              agentStates={agentStates} />
          )}
          {mobileTab === 'monitor' && (
            <div className="h-full overflow-y-auto">
              <AgentMonitor agents={agents} cost={cost} elapsed={elapsed} toolsUsed={toolsUsed}
                isPaused={isPaused} onPause={handlePause} onResume={handleResume} onStop={handleStop}
                collapsed={false} onToggleCollapse={() => setMobileTab('chat')}
                pipelineProgress={pipelineProgress} subtaskProgress={subtaskProgress} />
            </div>
          )}
        </div>

        <nav className="flex border-t border-kage-border bg-kage-card">
          {[
            { key: 'sidebar', icon: Menu, label: t('chat.newConversation') },
            { key: 'chat', icon: MessageSquare, label: 'Chat' },
            { key: 'monitor', icon: ShieldCheck, label: t('agents.monitor') },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setMobileTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                mobileTab === key ? 'text-kage-primary' : 'text-kage-sub'
              }`}>
              <Icon size={18} />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}
        </nav>

        <ApprovalDialog approval={approval} onApprove={handleApprove} onReject={handleReject} onModify={handleModify} />
      </div>
    );
  }

  // Desktop / Tablet layout
  return (
    <div className="h-screen flex flex-col bg-kage-bg">
      <header className="flex items-center justify-between px-4 py-2 border-b border-kage-border bg-kage-card flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {sidebarCollapsed && (
            <button onClick={() => setSidebarCollapsed(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors">
              <ChevronRight size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Shield size={22} className="text-kage-primary" />
            <span className="text-lg font-bold text-kage-text tracking-wide">{t('app.name')}</span>
          </div>
          <nav className="flex items-center gap-1 ml-4 overflow-x-auto scrollbar-hide">
            {NAV_ITEMS.map(({ key, icon: Icon }) => (
              <button key={key} onClick={() => setCurrentView(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all flex-shrink-0 whitespace-nowrap ${
                  currentView === key
                    ? 'bg-kage-primary/10 text-kage-primary font-medium'
                    : 'text-kage-sub hover:text-kage-text hover:bg-white/5'
                }`}>
                <Icon size={16} />
                <span className="hidden sm:inline">{
                  key === 'chat' ? 'Chat'
                  : key === 'queue' ? (t('queue.title') || 'Queue')
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
        <div className="flex items-center gap-3 flex-shrink-0">
          <ModelSelector compact />
          {isConnected && (
            <span className="flex items-center gap-1.5 text-xs text-kage-success">
              <span className="w-1.5 h-1.5 rounded-full bg-kage-success animate-pulse-glow" />
              SSE
            </span>
          )}
          {monitorCollapsed && isDesktop && (
            <button onClick={() => setMonitorCollapsed(false)}
              className="p-1.5 rounded-lg hover:bg-white/5 text-kage-sub hover:text-kage-text transition-colors">
              <ChevronLeft size={18} />
            </button>
          )}
          <button onClick={() => setCurrentView('settings')} className={`p-2 rounded-lg hover:bg-white/5 transition-colors ${currentView === 'settings' ? 'text-kage-primary' : 'text-kage-sub hover:text-kage-text'}`}>
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar conversations={conversations} activeConversationId={selectedConversation}
          onSelectConversation={handleSelectConversation} onNewConversation={handleNewConversation}
          onDeleteConversation={handleDeleteConversation} collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)} />

        <main className="flex-1 overflow-hidden">
          {currentView === 'chat' && (
            <ChatPanel messages={messages} isLoading={isLoading} onSendMessage={handleSendMessage}
              pipelineProgress={pipelineProgress} subtaskProgress={subtaskProgress} streamingText={streamingText}
              agentStates={agentStates} />
          )}
          {currentView === 'queue' && <TaskDashboard />}
          {currentView === 'tasks' && <TaskBuilder />}
          {currentView === 'tools' && <ToolManager />}
          {currentView === 'notifications' && <NotificationSettings />}
          {currentView === 'messaging' && <MessagingConfig />}
          {currentView === 'security' && <SecurityPanel />}
          {currentView === 'settings' && <SettingsPage />}
        </main>

        {isDesktop && (
          <AgentMonitor agents={agents} cost={cost} elapsed={elapsed} toolsUsed={toolsUsed}
            isPaused={isPaused} onPause={handlePause} onResume={handleResume} onStop={handleStop}
            collapsed={monitorCollapsed} onToggleCollapse={() => setMonitorCollapsed(!monitorCollapsed)}
            pipelineProgress={pipelineProgress} subtaskProgress={subtaskProgress} />
        )}

        {isTablet && showMonitorOverlay && (
          <div className="fixed inset-y-0 right-0 z-40 flex">
            <div className="w-screen bg-black/40" onClick={() => setShowMonitorOverlay(false)} />
            <div className="relative">
              <AgentMonitor agents={agents} cost={cost} elapsed={elapsed} toolsUsed={toolsUsed}
                isPaused={isPaused} onPause={handlePause} onResume={handleResume} onStop={handleStop}
                collapsed={false} onToggleCollapse={() => setShowMonitorOverlay(false)}
                pipelineProgress={pipelineProgress} subtaskProgress={subtaskProgress} />
            </div>
          </div>
        )}

        {isTablet && !showMonitorOverlay && (
          <button onClick={() => setShowMonitorOverlay(true)}
            className="fixed bottom-4 right-4 z-30 w-12 h-12 rounded-full bg-kage-primary text-white shadow-lg
                       flex items-center justify-center hover:bg-kage-primary/80 transition-colors"
            title={t('agents.monitor')}>
            <ShieldCheck size={20} />
          </button>
        )}
      </div>

      <ApprovalDialog approval={approval} onApprove={handleApprove} onReject={handleReject} onModify={handleModify} />
    </div>
  );
}
