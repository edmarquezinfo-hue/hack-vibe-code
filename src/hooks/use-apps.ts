import { useState, useEffect, useMemo } from 'react';

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
}

export function useApps() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApps = async () => {
    try {
      const response = await fetch(`/api/apps`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch apps');
      }

      const data = await response.json();
      console.log('Apps API response:', data);
      setApps(data.data?.apps || []);
    } catch (err) {
      console.error('Error fetching apps:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch apps');
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
    [...apps].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ).slice(0, TOPK),
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
  const { apps, loading, error } = useApps();
  
  // Memoized filtered favorite apps
  const favoriteApps = useMemo(() => 
    apps.filter(app => app.isFavorite), 
    [apps]
  );

  return { 
    apps: favoriteApps, 
    loading, 
    error, 
    refetch: () => {} // Favorites will update when main apps refetch
  };
}

export async function toggleFavorite(appId: string): Promise<boolean> {
  const response = await fetch(`/api/apps/${appId}/favorite`, {
    method: 'POST',
    credentials: 'include'
  });

  if (!response.ok) {
    throw new Error('Failed to toggle favorite');
  }

  const data = await response.json();
  return data.isFavorite;
}