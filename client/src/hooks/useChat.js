import { useState, useCallback } from 'react';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to load conversations');
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error('Failed to load conversation');
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConversation = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create conversation');
      const data = await res.json();
      setMessages([]);
      await loadConversations();
      return data.id;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, [loadConversations]);

  const deleteConversation = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete conversation');
      await loadConversations();
    } catch (err) {
      setError(err.message);
    }
  }, [loadConversations]);

  const sendMessage = useCallback(async (text, conversationId, { getFileResults, clearFileResults } = {}) => {
    if (!text.trim() || !conversationId) return;

    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      const responseText = data.content || data.response;
      if (responseText) {
        // Collect file results from SSE state
        const collectedFileResults = getFileResults ? getFileResults() : [];

        const assistantMessage = {
          id: data.messageId || `msg_${Date.now()}_resp`,
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toISOString(),
          agentTrace: data.trace || null,
          cost: data.cost || null,
          fileResults: collectedFileResults.length > 0 ? collectedFileResults : null,
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Clear collected file results
        if (clearFileResults) clearFileResults();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    messages,
    conversations,
    isLoading,
    error,
    sendMessage,
    loadConversation,
    loadConversations,
    createConversation,
    deleteConversation,
    setMessages,
  };
}
