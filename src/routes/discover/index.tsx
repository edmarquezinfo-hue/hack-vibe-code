import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { usePaginatedApps } from '@/hooks/use-paginated-apps';
import { AppListContainer } from '@/components/shared/AppListContainer';
import { AppFiltersForm } from '@/components/shared/AppFiltersForm';
import { AppSortTabs } from '@/components/shared/AppSortTabs';

export default function DiscoverPage() {
  const navigate = useNavigate();
  
  const {
    // Filter state
    searchQuery,
    setSearchQuery,
    filterFramework,
    sortBy,
    period,
    
    // Data state
    apps,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore,
    
    // Form handlers
    handleSearchSubmit,
    handleSortChange,
    handlePeriodChange,
    handleFrameworkChange,
    
    // Pagination handlers
    refetch,
    loadMore,
  } = usePaginatedApps({
    type: 'public',
    defaultSort: 'popular',
    defaultPeriod: 'week',
    limit: 20
  });

  return (
    <div className="min-h-screen bg-bg-light">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-[#f48120] to-[#faae42] bg-clip-text text-transparent">
              Discover Amazing Apps
            </h1>
            <p className="text-muted-foreground text-lg">
              Explore apps built by the community
            </p>
          </div>

          {/* Search and Filters */}
          <AppFiltersForm
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            searchPlaceholder="Search apps..."
            showSearchButton={true}
            filterFramework={filterFramework}
            onFrameworkChange={handleFrameworkChange}
            period={period}
            onPeriodChange={handlePeriodChange}
            sortBy={sortBy}
          />

          {/* Sort Tabs */}
          <div className="max-w-4xl mx-auto mb-8">
            <AppSortTabs
              value={sortBy}
              onValueChange={handleSortChange}
              availableSorts={['recent', 'popular', 'trending']}
            />
          </div>

          {/* Unified App List */}
          <AppListContainer
            apps={apps}
            loading={loading}
            loadingMore={loadingMore}
            error={error}
            hasMore={hasMore}
            totalCount={totalCount}
            sortBy={sortBy}
            onAppClick={(appId) => navigate(`/app/${appId}`)}
            onLoadMore={loadMore}
            onRetry={refetch}
            showUser={true}
            showStats={true}
            infiniteScroll={true}
          />
        </motion.div>
      </div>
    </div>
  );
}