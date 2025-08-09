import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, Search, Grid, List, Star, Lock, Users2, Globe, Code2, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useApps, toggleFavorite } from '@/hooks/use-apps';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isValid } from 'date-fns';

interface App {
  id: string;
  title: string;
  description?: string;
  framework?: string;
  updatedAt: string;
  visibility: 'private' | 'team' | 'board' | 'public';
  isFavorite?: boolean;
  iconUrl?: string | null;
}

export default function AppsPage() {
  const navigate = useNavigate();
  const { apps, loading, error, refetch } = useApps();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterFramework, setFilterFramework] = useState<string>('all');
  const [filterVisibility, setFilterVisibility] = useState<string>('all');

  const getFrameworkIcon = (framework?: string) => {
    switch (framework) {
      case 'react':
        return <Code2 className="h-5 w-5 text-blue-500" />;
      case 'vue':
        return <Code2 className="h-5 w-5 text-green-500" />;
      case 'svelte':
        return <Code2 className="h-5 w-5 text-orange-500" />;
      default:
        return <Code2 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getVisibilityIcon = (visibility: App['visibility']) => {
    switch (visibility) {
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'team':
        return <Users2 className="h-4 w-4" />;
      case 'board':
      case 'public':
        return <Globe className="h-4 w-4" />;
    }
  };

  const filteredApps = apps.filter(app => {
    const matchesSearch = app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFramework = filterFramework === 'all' || app.framework === filterFramework;
    const matchesVisibility = filterVisibility === 'all' || app.visibility === filterVisibility;
    
    return matchesSearch && matchesFramework && matchesVisibility;
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
    <div>
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">My Apps</h1>
              <p className="text-muted-foreground mt-1">
                {apps.length} app{apps.length !== 1 ? 's' : ''} created
              </p>
            </div>
          </div>
        </div>
        {/* Filters and Search */}
        <div className="mb-6 bg-background/50 backdrop-blur-sm rounded-lg p-4 border border-border/50">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
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
              </SelectContent>
            </Select>

            <Select value={filterVisibility} onValueChange={setFilterVisibility}>
              <SelectTrigger className="w-[150px]">
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

            <Tabs value={viewMode} onValueChange={(v: string) => setViewMode(v as 'grid' | 'list')}>
              <TabsList>
                <TabsTrigger value="grid">
                  <Grid className="h-4 w-4" />
                </TabsTrigger>
                <TabsTrigger value="list">
                  <List className="h-4 w-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Apps List */}
        <div className="">
          {loading ? (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "space-y-4"
            )}>
              {[...Array(8)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-destructive/10 p-3 mb-4">
                <X className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-muted-foreground mb-4">Failed to load apps</p>
              <Button onClick={refetch} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Code2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery || filterFramework !== 'all' || filterVisibility !== 'all' 
                  ? 'No apps match your filters' 
                  : 'No apps yet'}
              </h3>
              <p className="text-muted-foreground mb-6 text-sm max-w-sm text-center">
                {searchQuery || filterFramework !== 'all' || filterVisibility !== 'all' 
                  ? 'Try adjusting your search or filters to find what you\'re looking for.'
                  : 'Start building your first app with AI assistance.'}
              </p>
              {!searchQuery && filterFramework === 'all' && filterVisibility === 'all' && (
                <Button onClick={() => navigate('/chat/new')} className="bg-gradient-to-r from-[#f48120] to-[#faae42] hover:from-[#faae42] hover:to-[#f48120] text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Create your first app
                </Button>
              )}
            </div>
          ) : (
            <div className={cn(
              viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "space-y-4"
            )}>
              {filteredApps.map((app) => (
                <Card 
                  key={app.id} 
                  className="group hover:shadow-lg transition-all duration-200 cursor-pointer hover:-translate-y-1"
                  onClick={() => navigate(`/app/${app.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-sidebar-accent/50 p-2 flex-shrink-0">
                          {getFrameworkIcon(app.framework)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">{app.title}</CardTitle>
                          <CardDescription className="text-xs">
                            {(() => {
                              const date = new Date(app.updatedAt);
                              return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : 'Recently';
                            })()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-muted-foreground">{getVisibilityIcon(app.visibility)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(app.id);
                          }}
                        >
                          <Star 
                            className={cn(
                              "h-4 w-4 transition-colors",
                              app.isFavorite ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground hover:text-yellow-500"
                            )}
                          />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {app.description && (
                    <CardContent className='!px-4'>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {app.description}
                      </p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}