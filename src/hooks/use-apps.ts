import { useState, useEffect, useMemo } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { AppWithFavoriteStatus, EnhancedAppData, ApiResponse } from '@/api-types';
import { appEvents } from '@/lib/app-events';
import type { AppEvent, AppDeletedEvent, AppUpdatedEvent } from '@/lib/app-events';
import { useAuthGuard } from './useAuthGuard';
import { useAuth } from '@/contexts/auth-context';

interface AppHookState<T> {
  apps: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface AppHookOptions {
  shouldRefetchOnCreate?: boolean;
  shouldSkipCreate?: boolean;
}

type ApiAppsResponse<T> = Promise<ApiResponse<{ apps: T[] }>>;
type ApiFetcher<T> = () => ApiAppsResponse<T>;

/**
 * Generic hook factory for app data fetching with authentication guards and event handling
 */
function useAppsBase<T extends { id: string; updatedAt?: Date | string | null }>(
  apiFetcher: ApiFetcher<T>,
  options: AppHookOptions = {}
): AppHookState<T> {
  const { user } = useAuth();
  const [apps, setApps] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    if (!user) {
      setApps([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await apiFetcher();
      
      if (response.success) {
        setApps(response.data?.apps || []);
      } else {
        setError(response.error || 'Failed to fetch apps');
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
      if (err instanceof ApiError) {
        setError(`${err.message} (${err.status})`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch apps');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();

    const { shouldRefetchOnCreate = true, shouldSkipCreate = false } = options;
    
    const onDeleted = (event: AppEvent) => {
      if (event.type === 'app-deleted') {
        const deletedEvent = event as AppDeletedEvent;
        setApps(prevApps => prevApps.filter(app => app.id !== deletedEvent.appId));
      }
    };
    
    const onCreated = () => {
      if (!shouldSkipCreate && shouldRefetchOnCreate) {
        fetchApps();
      }
    };
    
    const onUpdated = (event: AppEvent) => {
      if (event.type === 'app-updated') {
        const updatedEvent = event as AppUpdatedEvent;
        if (updatedEvent.data) {
          setApps(prevApps => {
            const updatedApps = [...prevApps];
            const appIndex = updatedApps.findIndex(app => app.id === updatedEvent.appId);
            if (appIndex !== -1) {
              updatedApps[appIndex] = { 
                ...updatedApps[appIndex], 
                ...updatedEvent.data, 
                updatedAt: new Date() 
              } as T;
            }
            return updatedApps;
          });
        }
      }
    };

    const unsubscribeDeleted = appEvents.on('app-deleted', onDeleted);
    const unsubscribeCreated = appEvents.on('app-created', onCreated);
    const unsubscribeUpdated = appEvents.on('app-updated', onUpdated);

    return () => {
      unsubscribeDeleted();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, [user]);

  return { apps, loading, error, refetch: fetchApps };
}

export function useApps(): AppHookState<AppWithFavoriteStatus> {
  return useAppsBase(() => apiClient.getUserApps());
}

export const useUserApps = useApps;

export function useRecentApps() {
  const { apps, loading, error, refetch: refetchAll } = useApps();
  const TOPK = 10;
  
  const recentApps = useMemo(() => 
    [...apps].sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    }).slice(0, TOPK),
    [apps]
  );

  return { 
    apps: recentApps, 
    moreAvailable: apps.length > TOPK,
    loading, 
    error, 
    refetch: refetchAll
  };
}

export function useFavoriteApps(): AppHookState<AppWithFavoriteStatus> {
  return useAppsBase(() => apiClient.getFavoriteApps(), {
    shouldSkipCreate: true,
  });
}


export async function toggleFavorite(appId: string): Promise<boolean> {
  try {
    const response = await apiClient.toggleFavorite(appId);
    if (response.success && response.data) {
      return response.data.isFavorite;
    }
    throw new Error(response.error || 'Failed to toggle favorite');
  } catch (err) {
    if (err instanceof ApiError) {
      throw new Error(`Failed to toggle favorite: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Hook for protected toggle favorite functionality
 */
export function useToggleFavorite() {
  const { requireAuth } = useAuthGuard();

  const protectedToggleFavorite = async (appId: string, actionContext = 'to favorite this app'): Promise<boolean | null> => {
    if (!requireAuth({ 
      requireFullAuth: true, 
      actionContext 
    })) {
      return null;
    }

    return await toggleFavorite(appId);
  };

  return { toggleFavorite: protectedToggleFavorite };
}

/**
 * Hook for protected fork app functionality
 */
export function useForkApp() {
  const { requireAuth } = useAuthGuard();

  const forkApp = async (appId: string): Promise<any | null> => {
    if (!requireAuth({ 
      requireFullAuth: true, 
      actionContext: 'to fork this app' 
    })) {
      return null;
    }

    try {
      const response = await apiClient.forkApp(appId);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to fork app');
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(`Failed to fork app: ${err.message}`);
      }
      throw err;
    }
  };

  return { forkApp };
}