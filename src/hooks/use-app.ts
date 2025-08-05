import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import type { Blueprint } from '../../worker/agents/schemas';

interface App {
  id: string;
  title: string;
  description?: string;
  framework?: string;
  updatedAt: string;
  visibility: 'private' | 'team' | 'board' | 'public';
  isFavorite?: boolean;
  iconUrl?: string | null;
  status?: 'generating' | 'generated' | 'deployed' | 'error';
  createdAt?: string;
  blueprint?: Blueprint;
  originalPrompt?: string;
  finalPrompt?: string;
}

export function useApp(appId: string | undefined) {
  const { token } = useAuth();
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApp = useCallback(async () => {
    if (!token || !appId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/apps/${appId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch app');
      }

      const data = await response.json();
      console.log('App API response:', data);
      setApp(data.data?.app || null);
    } catch (err) {
      console.error('Error fetching app:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch app');
    } finally {
      setLoading(false);
    }
  }, [token, appId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  return { app, loading, error, refetch: fetchApp };
}