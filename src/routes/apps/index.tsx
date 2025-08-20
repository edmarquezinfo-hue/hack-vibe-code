import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Plus, Search, Clock, TrendingUp, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toggleFavorite } from '@/hooks/use-apps';
import { usePaginatedApps } from '@/hooks/use-paginated-apps';
import { AppListContainer } from '@/components/shared/AppListContainer';
import { TimePeriodSelector } from '@/components/shared/TimePeriodSelector';

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
          <div className="max-w-4xl mx-auto mb-8">
            <form onSubmit={handleSearchSubmit} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search your apps..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterFramework} onValueChange={handleFrameworkChange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Frameworks</SelectItem>
                  <SelectItem value="react">React</SelectItem>
                  <SelectItem value="vue">Vue</SelectItem>
                  <SelectItem value="svelte">Svelte</SelectItem>
                  <SelectItem value="angular">Angular</SelectItem>
                  <SelectItem value="vanilla">Vanilla JS</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterVisibility} onValueChange={handleVisibilityChange}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="board">Board</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
              {(sortBy === 'popular' || sortBy === 'trending') && (
                <TimePeriodSelector
                  value={period}
                  onValueChange={handlePeriodChange}
                  className="w-[120px]"
                  showForSort={sortBy}
                />
              )}
            </form>

            {/* Sort Tabs */}
            <Tabs value={sortBy} onValueChange={handleSortChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recent" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent
                </TabsTrigger>
                <TabsTrigger value="popular" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Popular
                </TabsTrigger>
                <TabsTrigger value="starred" className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Bookmarked
                </TabsTrigger>
              </TabsList>
            </Tabs>
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