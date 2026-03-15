import { useState, useEffect, useRef, useCallback } from 'react';

export function useMCPSuggestions(input) {
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectedServers, setConnectedServers] = useState(new Set());
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef(null);
  const lastInputRef = useRef('');
  const cacheRef = useRef(new Map());

  useEffect(() => {
    if (!input || input.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    // Reset dismissed when input changes significantly
    if (input !== lastInputRef.current) {
      setDismissed(false);
    }
    lastInputRef.current = input;

    // Check cache
    const cached = cacheRef.current.get(input.trim());
    if (cached) {
      setSuggestions(cached);
      return;
    }

    // Debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/suggestions/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: input.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          const filtered = data.suggestions.filter(
            s => !connectedServers.has(s.serverId)
          );
          setSuggestions(filtered);
          cacheRef.current.set(input.trim(), filtered);
        }
      } catch (err) {
        console.error('MCP suggestion error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, connectedServers]);

  const connectServer = useCallback(async (serverId) => {
    try {
      const res = await fetch('/api/tools/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId }),
      });
      if (res.ok) {
        setConnectedServers(prev => new Set([...prev, serverId]));
        setSuggestions(prev => prev.filter(s => s.serverId !== serverId));
        return true;
      }
    } catch (err) {
      console.error('Failed to connect MCP server:', err);
    }
    return false;
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    suggestions: dismissed ? [] : suggestions,
    isLoading,
    connectServer,
    dismiss,
  };
}
