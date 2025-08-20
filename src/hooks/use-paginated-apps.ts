import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { EnhancedAppData, AppWithUserAndStats, PaginationInfo, TimePeriod, AppSortOption, SortOrder } from '@/api-types';

export type AppType = 'user' | 'public';
export type AppListData = EnhancedAppData | AppWithUserAndStats;

interface UsePaginatedAppsOptions {
  type: AppType;
  sort?: AppSortOption;
  order?: SortOrder;
  period?: TimePeriod;
  framework?: string;
  search?: string;
  visibility?: string;
  status?: string;
  teamId?: string;
  boardId?: string;
  limit?: number;
  autoFetch?: boolean;
}

interface UsePaginatedAppsResult {
  apps: AppListData[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  pagination: PaginationInfo;
  hasMore: boolean;
  totalCount: number;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  updateFilters: (newOptions: Partial<UsePaginatedAppsOptions>) => void;
}

export function usePaginatedApps(initialOptions: UsePaginatedAppsOptions): UsePaginatedAppsResult {
  const [apps, setApps] = useState<AppListData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: initialOptions.limit || 20,
    offset: 0,
    total: 0,
    hasMore: false
  });
  const [options, setOptions] = useState(initialOptions);

  const fetchApps = useCallback(async (append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = append ? pagination.offset + pagination.limit : 0;
      const page = Math.floor(currentOffset / pagination.limit) + 1;

      const params = {
        page,
        limit: pagination.limit,
        sort: options.sort,
        order: options.order,
        period: options.period,
        framework: options.framework,
        search: options.search,
        visibility: options.visibility,
        status: options.status,
        teamId: options.teamId,
        boardId: options.boardId,
      };

      // Remove undefined values
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined)
      );

      let response;
      if (options.type === 'user') {
        response = await apiClient.getUserAppsWithPagination(cleanParams);
      } else {
        response = await apiClient.getPublicApps(cleanParams);
      }

      if (response.success && response.data) {
        const newApps = options.type === 'user' 
          ? (response.data as any).apps 
          : response.data.apps;
        
        const newPagination = options.type === 'user'
          ? (response.data as any).pagination
          : response.data.pagination;

        if (append) {
          setApps(prev => [...prev, ...newApps]);
        } else {
          setApps(newApps);
        }
        
        setPagination(newPagination);
      } else {
        throw new Error(response.error || 'Failed to fetch apps');
      }
    } catch (err) {
      console.error('Error fetching apps:', err);
      const errorMessage = err instanceof ApiError 
        ? `${err.message} (${err.status})`
        : err instanceof Error 
          ? err.message 
          : 'Failed to fetch apps';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [options, pagination.limit, pagination.offset]);

  const loadMore = useCallback(async () => {
    if (pagination.hasMore && !loadingMore) {
      await fetchApps(true);
    }
  }, [fetchApps, pagination.hasMore, loadingMore]);

  const updateFilters = useCallback((newOptions: Partial<UsePaginatedAppsOptions>) => {
    setOptions(prev => ({ ...prev, ...newOptions }));
    // Reset pagination when filters change
    setPagination(prev => ({ ...prev, offset: 0, total: 0, hasMore: false }));
  }, []);

  const refetch = useCallback(async () => {
    setPagination(prev => ({ ...prev, offset: 0, total: 0, hasMore: false }));
    await fetchApps(false);
  }, [fetchApps]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchApps();
    }
  }, [
    options.type,
    options.sort,
    options.order,
    options.period,
    options.framework,
    options.search,
    options.visibility,
    options.status,
    options.teamId,
    options.boardId,
    options.autoFetch,
    fetchApps
  ]);

  return {
    apps,
    loading,
    loadingMore,
    error,
    pagination,
    hasMore: pagination.hasMore,
    totalCount: pagination.total,
    refetch,
    loadMore,
    updateFilters,
  };
}