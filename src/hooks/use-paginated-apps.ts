import { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import type { EnhancedAppData, AppWithUserAndStats, PaginationInfo, TimePeriod, AppSortOption } from '@/api-types';
import { appEvents } from '@/lib/app-events';

export type AppType = 'user' | 'public';
export type AppListData = EnhancedAppData | AppWithUserAndStats;

interface UsePaginatedAppsOptions {
  type: AppType;
  defaultSort?: AppSortOption;
  defaultPeriod?: TimePeriod;
  defaultFramework?: string;
  defaultVisibility?: string;
  includeVisibility?: boolean;
  limit?: number;
  autoFetch?: boolean;
}

interface FilterState {
  searchQuery: string;
  filterFramework: string;
  filterVisibility: string;
  sortBy: AppSortOption;
  period: TimePeriod;
}

interface UsePaginatedAppsResult extends FilterState {
  // Data state
  apps: AppListData[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  pagination: PaginationInfo;
  hasMore: boolean;
  totalCount: number;
  
  // Form handlers
  setSearchQuery: (query: string) => void;
  handleSearchSubmit: (e: React.FormEvent) => void;
  handleSortChange: (sort: string) => void;
  handlePeriodChange: (period: TimePeriod) => void;
  handleFrameworkChange: (framework: string) => void;
  handleVisibilityChange: (visibility: string) => void;
  
  // Pagination handlers
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  removeApp: (appId: string) => void;
}

export function usePaginatedApps(options: UsePaginatedAppsOptions): UsePaginatedAppsResult {
  // Initialize filter state with provided defaults
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    filterFramework: options.defaultFramework || 'all',
    filterVisibility: options.defaultVisibility || 'all',
    sortBy: options.defaultSort || 'recent',
    period: options.defaultPeriod || 'all'
  });

  // Debounced search query to prevent API calls on every keystroke
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // API state
  const [apps, setApps] = useState<AppListData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    limit: options.limit || 20,
    offset: 0,
    total: 0,
    hasMore: false
  });

  // Debounce search query with 500ms delay
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(filterState.searchQuery);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filterState.searchQuery]);

  // Stable fetch function that doesn't change unless API params change
  const fetchApps = useCallback(async (append = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = append ? pagination.offset + pagination.limit : 0;
      const page = Math.floor(currentOffset / (pagination.limit || 20)) + 1;

      const params = {
        page,
        limit: pagination.limit,
        sort: filterState.sortBy,
        period: filterState.period,
        framework: filterState.filterFramework === 'all' ? undefined : filterState.filterFramework,
        search: debouncedSearchQuery || undefined,
        visibility: (options.includeVisibility && filterState.filterVisibility !== 'all') ? filterState.filterVisibility : undefined,
      };

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
          ? (response.data as { apps: AppListData[]; pagination: PaginationInfo }).apps 
          : response.data.apps;
        
        const newPagination = options.type === 'user'
          ? (response.data as { apps: AppListData[]; pagination: PaginationInfo }).pagination
          : response.data.pagination;

        if (append) {
          setApps(prev => [...prev, ...newApps]);
          setPagination(newPagination);
        } else {
          setApps(newApps);
          setPagination(newPagination);
        }
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
  }, [
    options.type, 
    options.includeVisibility,
    pagination.limit,
    pagination.offset,
    filterState.sortBy,
    filterState.period,
    filterState.filterFramework,
    filterState.filterVisibility,
    debouncedSearchQuery
  ]);

  // Load more function
  const loadMore = useCallback(async () => {
    if (pagination.hasMore && !loadingMore) {
      await fetchApps(true);
    }
  }, [pagination.hasMore, loadingMore, fetchApps]);

  // Refetch function
  const refetch = useCallback(async () => {
    setPagination(prev => ({ ...prev, offset: 0, total: 0, hasMore: false }));
    await fetchApps(false);
  }, [fetchApps]);

  // Remove app function
  const removeApp = useCallback((appId: string) => {
    setApps(prev => prev.filter(app => app.id !== appId));
    setPagination(prev => ({ 
      ...prev, 
      total: Math.max(0, prev.total - 1) 
    }));
  }, []);

  // Form handlers that update state and trigger refetch
  const setSearchQuery = useCallback((query: string) => {
    setFilterState(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    refetch();
  }, [refetch]);

  const handleSortChange = useCallback((newSort: string) => {
    const sort = newSort as AppSortOption;
    setFilterState(prev => ({ ...prev, sortBy: sort }));
    // Reset pagination and refetch
    setPagination(prev => ({ ...prev, offset: 0, total: 0, hasMore: false }));
    // Refetch will be triggered by useEffect
  }, []);

  const handlePeriodChange = useCallback((newPeriod: TimePeriod) => {
    setFilterState(prev => ({ ...prev, period: newPeriod }));
    // Reset pagination and refetch
    setPagination(prev => ({ ...prev, offset: 0, total: 0, hasMore: false }));
    // Refetch will be triggered by useEffect
  }, []);

  const handleFrameworkChange = useCallback((framework: string) => {
    setFilterState(prev => ({ ...prev, filterFramework: framework }));
    // Reset pagination and refetch
    setPagination(prev => ({ ...prev, offset: 0, total: 0, hasMore: false }));
    // Refetch will be triggered by useEffect
  }, []);

  const handleVisibilityChange = useCallback((visibility: string) => {
    setFilterState(prev => ({ ...prev, filterVisibility: visibility }));
    // Reset pagination and refetch
    setPagination(prev => ({ ...prev, offset: 0, total: 0, hasMore: false }));
    // Refetch will be triggered by useEffect
  }, []);

  // Effect to fetch on filter changes - clean dependencies
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchApps(false);
    }
  }, [
    fetchApps,
    options.autoFetch
  ]);

  // Listen for app deletion events
  useEffect(() => {
    const unsubscribe = appEvents.on('app-deleted', (event) => {
      removeApp(event.appId);
    });
    return unsubscribe;
  }, [removeApp]);

  return {
    // Filter state
    searchQuery: filterState.searchQuery,
    filterFramework: filterState.filterFramework,
    filterVisibility: options.includeVisibility ? filterState.filterVisibility : 'all',
    sortBy: filterState.sortBy,
    period: filterState.period,
    
    // Data state
    apps,
    loading,
    loadingMore,
    error,
    pagination,
    hasMore: pagination.hasMore,
    totalCount: pagination.total,
    
    // Form handlers
    setSearchQuery,
    handleSearchSubmit,
    handleSortChange,
    handlePeriodChange,
    handleFrameworkChange,
    handleVisibilityChange,
    
    // Pagination handlers
    refetch,
    loadMore,
    removeApp,
  };
}