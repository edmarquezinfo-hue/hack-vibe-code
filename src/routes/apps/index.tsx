import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toggleFavorite } from '@/hooks/use-apps';
import { usePaginatedApps } from '@/hooks/use-paginated-apps';
import { AppListContainer } from '@/components/shared/AppListContainer';
import { AppFiltersForm } from '@/components/shared/AppFiltersForm';
import { AppSortTabs } from '@/components/shared/AppSortTabs';

export default function AppsPage() {
  const navigate = useNavigate();
  
  const {
    // Filter state
    searchQuery,
    setSearchQuery,
    filterFramework,
    filterVisibility,
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
    handleVisibilityChange,
    
    // Pagination handlers
    refetch,
    loadMore,
  } = usePaginatedApps({
    type: 'user',
    defaultSort: 'recent',
    includeVisibility: true,
    limit: 20
  });

  const handleToggleFavorite = async (appId: string) => {
    try {
      await toggleFavorite(appId);
      refetch();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

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
              My Apps
            </h1>
            <p className="text-muted-foreground text-lg">
              {loading ? 'Loading...' : `${totalCount} app${totalCount !== 1 ? 's' : ''} in your workspace`}
            </p>
          </div>

          {/* Search and Filters */}
          <AppFiltersForm
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            searchPlaceholder="Search your apps..."
            filterFramework={filterFramework}
            onFrameworkChange={handleFrameworkChange}
            filterVisibility={filterVisibility}
            onVisibilityChange={handleVisibilityChange}
            showVisibility={true}
            period={period}
            onPeriodChange={handlePeriodChange}
            sortBy={sortBy}
          />

          {/* Sort Tabs */}
          <div className="max-w-4xl mx-auto mb-8">
            <AppSortTabs
              value={sortBy}
              onValueChange={handleSortChange}
              availableSorts={['recent', 'popular', 'starred']}
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
            sortBy={sortBy === 'starred' ? 'starred' : sortBy}
            onAppClick={(appId) => navigate(`/app/${appId}`)}
            onToggleFavorite={handleToggleFavorite}
            onLoadMore={loadMore}
            onRetry={refetch}
            showUser={false}
            showStats={true}
            showActions={true}
            infiniteScroll={true}
            emptyState={
              !searchQuery && filterFramework === 'all' && filterVisibility === 'all' && sortBy === 'recent' && totalCount === 0
                ? {
                    title: 'No apps yet',
                    description: 'Start building your first app with AI assistance.',
                    action: (
                      <Button 
                        onClick={() => navigate('/')} 
                        className="bg-gradient-to-r from-[#f48120] to-[#faae42] hover:from-[#faae42] hover:to-[#f48120] text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create your first app
                      </Button>
                    )
                  }
                : undefined
            }
          />
        </motion.div>
      </div>
    </div>
  );
}