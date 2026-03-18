import { useState, useCallback, useRef } from 'react';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const streamingTextRef = useRef('');

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

  // Called by SSE hook when response:chunk arrives
  const appendStreamingChunk = useCallback((chunk) => {
    streamingTextRef.current += chunk;
    setStreamingText(streamingTextRef.current);
  }, []);

  // Reset streaming state
  const clearStreaming = useCallback(() => {
    streamingTextRef.current = '';
    setStreamingText('');
  }, []);

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
    // Reset streaming text for new message
    streamingTextRef.current = '';
    setStreamingText('');

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

        // Clear collected file results and streaming text
        if (clearFileResults) clearFileResults();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      // Clear streaming state after response is committed
      streamingTextRef.current = '';
      setStreamingText('');
    }
  }, []);

  return {
    messages,
    conversations,
    isLoading,
    error,
    streamingText,
    sendMessage,
    loadConversation,
    loadConversations,
    createConversation,
    deleteConversation,
    setMessages,
    appendStreamingChunk,
    clearStreaming,
  };
}
