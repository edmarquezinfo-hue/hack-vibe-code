import { useState, useEffect, useMemo } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { AppWithFavoriteStatus, EnhancedAppData } from '@/api-types';
import { appEvents } from '@/lib/app-events';
import type { AppEvent, AppDeletedEvent, AppUpdatedEvent } from '@/lib/app-events';

// Reusable event handlers to maximize code reuse and minimize duplication
const createAppEventHandlers = <T extends { id: string; updatedAt?: Date | string | null }>(
  setApps: React.Dispatch<React.SetStateAction<T[]>>,
  refetchApps?: () => void,
  options?: {
    shouldRefetchOnCreate?: boolean;
    shouldSkipCreate?: boolean;
  }
) => {
  const { shouldRefetchOnCreate = true, shouldSkipCreate = false } = options || {};
  
  return {
    onDeleted: (event: AppEvent) => {
      if (event.type === 'app-deleted') {
        const deletedEvent = event as AppDeletedEvent;
        setApps(prevApps => prevApps.filter(app => app.id !== deletedEvent.appId));
      }
    },
    
    onCreated: () => {
      if (!shouldSkipCreate && shouldRefetchOnCreate && refetchApps) {
        refetchApps();
      }
    },
    
    onUpdated: (event: AppEvent) => {
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
    }
  };
};

export function useApps() {
  const [apps, setApps] = useState<AppWithFavoriteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUserApps();
      
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

    // Use reusable event handlers to eliminate code duplication
    const eventHandlers = createAppEventHandlers(setApps, fetchApps);
    const unsubscribeDeleted = appEvents.on('app-deleted', eventHandlers.onDeleted);
    const unsubscribeCreated = appEvents.on('app-created', eventHandlers.onCreated);
    const unsubscribeUpdated = appEvents.on('app-updated', eventHandlers.onUpdated);

    return () => {
      unsubscribeDeleted();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

  return { apps, loading, error, refetch: fetchApps };
}

// Alias for useApps - used in dashboard
export const useUserApps = useApps;

export function useRecentApps() {
  const { apps, loading, error, refetch: refetchAll } = useApps();
  const TOPK = 10;
  
  // Memoized sorted recent apps (last 10)
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
    refetch: refetchAll // This will now properly refetch all apps
  };
}

export function useFavoriteApps() {
  const [favoriteApps, setFavoriteApps] = useState<AppWithFavoriteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFavoriteApps();
      
      if (response.success) {
        setFavoriteApps(response.data?.apps || []);
      } else {
        setError(response.error || 'Failed to fetch favorite apps');
      }
    } catch (err) {
      console.error('Error fetching favorite apps:', err);
      if (err instanceof ApiError) {
        setError(`${err.message} (${err.status})`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch favorite apps');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();

    // Use reusable event handlers with configuration for favorite apps behavior
    const eventHandlers = createAppEventHandlers(setFavoriteApps, fetchFavorites, {
      shouldSkipCreate: true, // New creations don't automatically become favorites
    });
    const unsubscribeDeleted = appEvents.on('app-deleted', eventHandlers.onDeleted);
    const unsubscribeCreated = appEvents.on('app-created', eventHandlers.onCreated);
    const unsubscribeUpdated = appEvents.on('app-updated', eventHandlers.onUpdated);

    return () => {
      unsubscribeDeleted();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

  return { 
    apps: favoriteApps, 
    loading, 
    error, 
    refetch: fetchFavorites
  };
}

// Enhanced Apps Hook - for redesigned apps page with stats
export function useEnhancedApps() {
  const [apps, setApps] = useState<EnhancedAppData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getUserAppsWithPagination();
      
      if (response.success) {
        setApps(response.data?.apps || []);
      } else {
        setError(response.error || 'Failed to fetch apps');
      }
    } catch (err) {
      console.error('Error fetching enhanced apps:', err);
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

    // Use reusable event handlers to eliminate code duplication
    const eventHandlers = createAppEventHandlers(setApps, fetchApps);
    const unsubscribeDeleted = appEvents.on('app-deleted', eventHandlers.onDeleted);
    const unsubscribeCreated = appEvents.on('app-created', eventHandlers.onCreated);
    const unsubscribeUpdated = appEvents.on('app-updated', eventHandlers.onUpdated);

    return () => {
      unsubscribeDeleted();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

  return { apps, loading, error, refetch: fetchApps };
}

// Enhanced Recent Apps Hook
export function useEnhancedRecentApps() {
  const { apps, loading, error, refetch: refetchAll } = useEnhancedApps();
  const TOPK = 10;
  
  // Memoized sorted recent apps (last 10)
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
    refetch: refetchAll // This will now properly refetch all apps
  };
}

// Enhanced Favorite Apps Hook - using existing favorite endpoint for now
// TODO: Create enhanced favorite endpoint if needed
export function useEnhancedFavoriteApps() {
  const [favoriteApps, setFavoriteApps] = useState<AppWithFavoriteStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFavoriteApps();
      
      if (response.success) {
        setFavoriteApps(response.data?.apps || []);
      } else {
        setError(response.error || 'Failed to fetch favorite apps');
      }
    } catch (err) {
      console.error('Error fetching favorite apps:', err);
      if (err instanceof ApiError) {
        setError(`${err.message} (${err.status})`);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to fetch favorite apps');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();

    // Use reusable event handlers with configuration for enhanced favorite apps behavior
    const eventHandlers = createAppEventHandlers(setFavoriteApps, fetchFavorites, {
      shouldSkipCreate: true, // New creations don't automatically become favorites
    });
    const unsubscribeDeleted = appEvents.on('app-deleted', eventHandlers.onDeleted);
    const unsubscribeCreated = appEvents.on('app-created', eventHandlers.onCreated);
    const unsubscribeUpdated = appEvents.on('app-updated', eventHandlers.onUpdated);

    return () => {
      unsubscribeDeleted();
      unsubscribeCreated();
      unsubscribeUpdated();
    };
  }, []);

  return { 
    apps: favoriteApps, 
    loading, 
    error, 
    refetch: fetchFavorites
  };
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