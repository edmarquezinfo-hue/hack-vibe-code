import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, Star, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePaginatedApps } from '@/hooks/use-paginated-apps';
import { AppListContainer } from '@/components/shared/AppListContainer';
import { TimePeriodSelector } from '@/components/shared/TimePeriodSelector';
import type { AppSortOption, TimePeriod } from '@/api-types';

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFramework, setFilterFramework] = useState<string>('all');
  const [sortBy, setSortBy] = useState<AppSortOption>('recent');
  const [period, setPeriod] = useState<TimePeriod>('all');

  // Use unified paginated apps hook for public apps with server-side sorting
  const {
    apps,
    loading,
    loadingMore,
    error,
    totalCount,
    hasMore,
    refetch,
    loadMore,
    updateFilters
  } = usePaginatedApps({
    type: 'public',
    sort: sortBy,
    period: period,
    framework: filterFramework === 'all' ? undefined : filterFramework,
    search: searchQuery || undefined,
    limit: 20
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: searchQuery || undefined });
  };

  const handleSortChange = (newSort: string) => {
    const sort = newSort as AppSortOption;
    setSortBy(sort);
    updateFilters({ sort });
  };

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
    updateFilters({ period: newPeriod });
  };

  const handleFrameworkChange = (framework: string) => {
    setFilterFramework(framework);
    updateFilters({ framework: framework === 'all' ? undefined : framework });
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
              Discover Amazing Apps
            </h1>
            <p className="text-muted-foreground text-lg">
              Explore apps built by the community with AI
            </p>
          </div>

          {/* Search and Filters */}
          <div className="max-w-4xl mx-auto mb-8">
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search apps..."
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
              {(sortBy === 'popular' || sortBy === 'trending') && (
                <TimePeriodSelector
                  value={period}
                  onValueChange={handlePeriodChange}
                  className="w-[120px]"
                  showForSort={sortBy}
                />
              )}
              <Button type="submit">
                Search
              </Button>
            </form>

            {/* Sort Tabs */}
            <Tabs value={sortBy} onValueChange={handleSortChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recent" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent
                </TabsTrigger>
                <TabsTrigger value="popular" className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Popular
                </TabsTrigger>
                <TabsTrigger value="trending" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Trending
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
            sortBy={sortBy}
            onAppClick={(appId) => navigate(`/app/${appId}`)}
            onLoadMore={loadMore}
            onRetry={refetch}
            showUser={true}
            showStats={true}
          />
        </motion.div>
      </div>
    </div>
  );
}