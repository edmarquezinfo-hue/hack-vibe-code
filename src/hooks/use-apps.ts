import { useState, useEffect, useMemo } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { AppWithFavoriteStatus, EnhancedAppData } from '@/api-types';

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
  }, []);

  return { apps, loading, error, refetch: fetchApps };
}

// Alias for useApps - used in dashboard
export const useUserApps = useApps;

export function useRecentApps() {
  const { apps, loading, error } = useApps();
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
    refetch: () => {} // Recent apps will update when main apps refetch
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
  }, []);

  return { apps, loading, error, refetch: fetchApps };
}

// Enhanced Recent Apps Hook
export function useEnhancedRecentApps() {
  const { apps, loading, error } = useEnhancedApps();
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
    refetch: () => {} // Recent apps will update when main apps refetch
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