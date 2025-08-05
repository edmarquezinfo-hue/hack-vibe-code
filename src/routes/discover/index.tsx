import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { 
  Clock, 
  TrendingUp, 
  Star, 
  Eye, 
  GitBranch,
  Code2,
  Search,
  Loader2,
  Sparkles,
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/auth-context';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface PublicApp {
  id: string;
  title: string;
  description?: string;
  framework: string;
  deploymentUrl?: string;
  cloudflareUrl?: string;
  createdAt: string;
  viewCount: number;
  forkCount: number;
  starCount: number;
  userName?: string;
  userAvatar?: string;
  userStarred?: boolean;
  userFavorited?: boolean;
}

interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  
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

      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: append ? (pagination.offset + pagination.limit).toString() : '0',
        sort: sortBy
      });

      if (searchQuery) params.append('search', searchQuery);
      if (framework !== 'all') params.append('framework', framework);

      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`/api/apps/public?${params}`, { headers });
      
      if (!response.ok) throw new Error('Failed to fetch apps');
      
      const data = await response.json();
      
      if (append) {
        setApps(prev => [...prev, ...data.data.apps]);
      } else {
        setApps(data.data.apps);
      }
      
      setPagination(data.data.pagination);
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
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Use the public endpoint with trending sort
      const response = await fetch('/api/apps/public?sort=trending&limit=10', { headers });
      
      if (!response.ok) throw new Error('Failed to fetch trending apps');
      
      const data = await response.json();
      setTrendingApps(data.data.apps);
    } catch (error) {
      console.error('Error fetching trending apps:', error);
    }
  };

  useEffect(() => {
    fetchApps();
    fetchTrendingApps();
  }, [sortBy, framework]);

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

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100
      }
    }
  };

  const AppCard = ({ app }: { app: PublicApp }) => {
    return (
      <motion.div variants={itemVariants}>
        <Card 
          className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group"
          onClick={() => navigate(`/app/${app.id}`)}
        >
          {/* Preview Image or Placeholder */}
          <div className="relative h-48 bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden">
            <div className="w-full h-full flex items-center justify-center">
              <Code2 className="h-16 w-16 text-orange-300" />
            </div>
            
            {/* Framework Badge */}
            <Badge 
              variant="secondary" 
              className="absolute top-2 right-2 bg-background/90 dark:bg-card/90 backdrop-blur-sm"
            >
              {app.framework}
            </Badge>
          </div>

          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-orange-600 transition-colors">
                {app.title}
              </h3>
            </div>
            
            {app.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {app.description}
              </p>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            {/* User Info */}
            <div className="flex items-center gap-2 mb-3">
              {app.userName === 'Anonymous User' ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center">
                    <User className="h-3 w-3 text-white" />
                  </div>
                  <span>Anonymous User</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={app.userAvatar} />
                    <AvatarFallback className="text-xs">
                      {app.userName?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground">{app.userName}</span>
                </div>
              )}
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
              </span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                <span>{app.viewCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className={cn("h-3.5 w-3.5", app.userStarred && "fill-yellow-500 text-yellow-500")} />
                <span>{app.starCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5" />
                <span>{app.forkCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
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
          {trendingApps.length > 0 && sortBy === 'recent' && (
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
                  <AppCard key={app.id} app={app} />
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
                  <AppCard key={app.id} app={app} />
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