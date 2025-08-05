import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface UserStats {
  totalApps: number;
  publicApps: number;
  totalViews: number;
  totalLikes: number;
  favoriteCount: number;
  teamCount: number;
  boardCount: number;
  streak: number;
  achievements: Array<{
    id: string;
    name: string;
    description?: string;
    unlockedAt: string;
    icon?: React.ComponentType<{ className?: string }>;
    color?: string;
    [key: string]: unknown;
  }>;
}

interface Activity {
  type: string;
  title: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function useUserStats() {
  const { isAuthenticated } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    totalApps: 0,
    publicApps: 0,
    totalViews: 0,
    totalLikes: 0,
    favoriteCount: 0,
    teamCount: 0,
    boardCount: 0,
    streak: 0,
    achievements: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/stats`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      console.log('Stats API response:', data);
      setStats(data.data || data);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

export function useUserActivity() {
  const { isAuthenticated } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/stats/activity`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data = await response.json();
      console.log('Activity API response:', data);
      setActivities(data.data?.activities || []);
    } catch (err) {
      console.error('Error fetching activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch activity');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return { activities, loading, error, refetch: fetchActivity };
}