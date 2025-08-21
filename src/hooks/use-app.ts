import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type { App } from '@/api-types';

export function useApp(appId: string | undefined) {
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApp = useCallback(async () => {
    if (!appId) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.getAppDetails(appId);
      setApp(response.data?.app || null);
    } catch (err) {
      console.error('Error fetching app:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch app');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchApp();
  }, [fetchApp]);

  return { app, loading, error, refetch: fetchApp };
}