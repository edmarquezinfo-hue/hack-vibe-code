import { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'framer-motion';
import { Plus, Search, Clock, TrendingUp, Star, Loader2, Code2, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnhancedApps, toggleFavorite } from '@/hooks/use-apps';
import { AppCard } from '@/components/shared/AppCard';

export default function AppsPage() {
  const navigate = useNavigate();
  const { apps, loading, error, refetch } = useEnhancedApps();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFramework, setFilterFramework] = useState<string>('all');
  const [filterVisibility, setFilterVisibility] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'starred'>('recent');

  // Filter and sort apps
  const filteredApps = apps.filter(app => {
    const matchesSearch = app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFramework = filterFramework === 'all' || app.framework === filterFramework;
    const matchesVisibility = filterVisibility === 'all' || app.visibility === filterVisibility;
    
    return matchesSearch && matchesFramework && matchesVisibility;
  });

  // Sort filtered apps
  const sortedApps = [...filteredApps].sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        const aScore = (a.viewCount || 0) + (a.starCount || 0) * 2 + (a.forkCount || 0) * 3;
        const bScore = (b.viewCount || 0) + (b.starCount || 0) * 2 + (b.forkCount || 0) * 3;
        return bScore - aScore;
      case 'starred':
        if (a.userFavorited && !b.userFavorited) return -1;
        if (!a.userFavorited && b.userFavorited) return 1;
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
      case 'recent':
      default:
        return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    }
  });

  const handleToggleFavorite = async (appId: string) => {
    try {
      await toggleFavorite(appId);
      refetch();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search happens automatically through filtering
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
              {apps.length} app{apps.length !== 1 ? 's' : ''} in your workspace
            </p>
          </div>

          {/* Search and Filters */}
          <div className="max-w-4xl mx-auto mb-8">
            <form onSubmit={handleSearch} className="flex gap-2 mb-4">
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
              <Select value={filterFramework} onValueChange={setFilterFramework}>
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
              <Select value={filterVisibility} onValueChange={setFilterVisibility}>
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
            </form>

            {/* Sort Tabs */}
            <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="w-full">
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

          {/* Main Apps Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="rounded-full bg-destructive/10 p-3 mb-4 inline-flex">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Failed to load apps</h3>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={refetch} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : sortedApps.length === 0 ? (
            <div className="text-center py-20">
              <Code2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">
                {searchQuery || filterFramework !== 'all' || filterVisibility !== 'all' 
                  ? 'No apps match your filters' 
                  : 'No apps yet'}
              </h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery || filterFramework !== 'all' || filterVisibility !== 'all' 
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Start building your first app with AI assistance.'}
              </p>
              {!searchQuery && filterFramework === 'all' && filterVisibility === 'all' && (
                <Button 
                  onClick={() => navigate('/')} 
                  className="bg-gradient-to-r from-[#f48120] to-[#faae42] hover:from-[#faae42] hover:to-[#f48120] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first app
                </Button>
              )}
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {sortedApps.map(app => (
                <AppCard 
                  key={app.id} 
                  app={app}
                  onClick={(appId) => navigate(`/app/${appId}`)}
                  onToggleFavorite={handleToggleFavorite}
                  showStats={true}
                  showUser={false}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}