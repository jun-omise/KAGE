import { useState, useCallback } from 'react';

/**
 * Parse {{variable}} patterns from template text.
 */
export function parseVariables(text) {
  if (!text) return [];
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  const unique = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))];
  return unique;
}

/**
 * Substitute variables into template text.
 */
export function substituteVariables(text, variables) {
  if (!text || !variables) return text;
  let result = text;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export function useTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks?is_template=true');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTemplate = useCallback(async ({ name, description, template_text, variables }) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          template_text,
          variables: variables || parseVariables(template_text).map(v => ({ name: v, label: v, default: '' })),
          is_template: true,
          trigger_type: 'manual',
        }),
      });
      if (!res.ok) throw new Error('Failed to create template');
      const data = await res.json();
      setTemplates(prev => [data, ...prev]);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const executeTemplate = useCallback(async (id, variables) => {
    try {
      const res = await fetch(`/api/tasks/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables }),
      });
      if (!res.ok) throw new Error('Failed to execute template');
      return await res.json();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteTemplate = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate,
    executeTemplate,
    deleteTemplate,
    parseVariables,
    substituteVariables,
  };
}
