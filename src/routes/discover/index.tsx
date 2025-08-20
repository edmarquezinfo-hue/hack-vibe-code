import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import type { AppWithUserAndStats, PaginationInfo as ApiPaginationInfo } from '@/api-types';
import { 
  Clock, 
  TrendingUp, 
  Star, 
  Search,
  Loader2,
  Sparkles,
  Code2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppCard } from '@/components/shared/AppCard';

// Use proper types from API
type PublicApp = AppWithUserAndStats;
type PaginationInfo = ApiPaginationInfo;

export default function DiscoverPage() {
  const navigate = useNavigate();
  
  const [apps, setApps] = useState<PublicApp[]>([]);
  const [trendingApps, setTrendingApps] = useState<PublicApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [framework, setFramework] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent');
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: true
  });

  // Fetch public apps
  const fetchApps = async (append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);

      const paginationParams = {
        limit: pagination.limit,
        page: append ? Math.floor(pagination.offset / pagination.limit) + 2 : 1,
        sort: sortBy === 'recent' ? 'updatedAt' : sortBy === 'trending' ? 'starCount' : 'createdAt',
        order: 'desc' as const
      };
      
      const response = await apiClient.getPublicApps(paginationParams);
      
      if (response.success && response.data) {
        const data = response.data;
        
        if (append) {
          setApps(prev => [...prev, ...data.apps]);
        } else {
          setApps(data.apps);
        }
        
        setPagination(data.pagination);
      } else {
        throw new Error(response.error || 'Failed to fetch apps');
      }
    } catch (error) {
      console.error('Error fetching apps:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Fetch trending apps
  const fetchTrendingApps = async () => {
    try {
      const response = await apiClient.getPublicApps({
        limit: 10,
        sort: 'starCount',
        order: 'desc'
      });
      
      if (response.success && response.data) {
        setTrendingApps(response.data.apps);
      } else {
        throw new Error(response.error || 'Failed to fetch trending apps');
      }
    } catch (error) {
      console.error('Error fetching trending apps:', error);
    }
  };

  useEffect(() => {
    fetchApps();
    fetchTrendingApps();
  }, [sortBy, framework, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApps();
  };

  const handleLoadMore = () => {
    if (pagination.hasMore && !loadingMore) {
      fetchApps(true);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const PublicAppCard = ({ app }: { app: PublicApp }) => {
    return (
      <AppCard 
        app={app}
        onClick={(appId) => navigate(`/app/${appId}`)}
        showStats={true}
        showUser={true}
        className="h-full"
      />
    );
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
              <Select value={framework} onValueChange={setFramework}>
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
              <Button type="submit">
                Search
              </Button>
            </form>

            {/* Sort Tabs */}
            <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="w-full">
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

          {/* Trending Section */}
          {trendingApps.length > 0 && sortBy === 'trending' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-12"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-orange-500" />
                <h2 className="text-2xl font-semibold">Trending This Week</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {trendingApps.slice(0, 4).map(app => (
                  <PublicAppCard key={app.id} app={app} />
                ))}
              </div>
            </motion.div>
          )}

          {/* Main Apps Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : apps.length === 0 ? (
            <div className="text-center py-20">
              <Code2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No apps found</h3>
              <p className="text-muted-foreground">
                Try adjusting your filters or search query
              </p>
            </div>
          ) : (
            <>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {apps.map(app => (
                  <PublicAppCard key={app.id} app={app} />
                ))}
              </motion.div>

              {/* Load More Button */}
              {pagination.hasMore && (
                <div className="flex justify-center mt-8">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}