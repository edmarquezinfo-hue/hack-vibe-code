import { useAuth } from '@/contexts/auth-context';
import { useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Plus,
  Clock, 
  Star, 
  Users,
  Zap,
  Code2,
  GitBranch,
  ArrowRight,
  Sparkles,
  Activity,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useUserApps } from '@/hooks/use-apps';
import { formatDistanceToNow, isValid } from 'date-fns';
import { AppCard } from '@/components/dashboard/AppCard';

// Helper function for consistent date formatting
const formatAppDate = (dateString: string): string => {
  const date = new Date(dateString);
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : 'Recently';
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Fetch real data
  const { apps, loading: appsLoading } = useUserApps();

  // Calculate real stats (memoized to avoid re-computation)
  const stats = useMemo(() => ({
    totalApps: apps.length,
    activeProjects: apps.filter(app => app.status === 'generating' || app.status === 'generated').length,
    deployedApps: apps.filter(app => app.status === 'deployed').length,
    totalViews: 0, // TODO: Implement view tracking
    favoriteCount: apps.filter(app => app.isFavorite).length,
    teamCount: 0, // TODO: Implement teams
    boardCount: 0 // TODO: Implement boards
  }), [apps]);

  // Get recent apps for activity and top apps (memoized)
  const recentApps = useMemo(() => 
    [...apps].sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ).slice(0, 5)
  , [apps]);
  
  // Top apps with formatted dates (memoized)
  const topApps = useMemo(() => 
    recentApps.slice(0, 3).map(app => ({
      ...app,
      views: 0, // TODO: Implement view tracking
      likes: app.isFavorite ? 1 : 0,
      lastUpdated: formatAppDate(app.updatedAt)
    }))
  , [recentApps]);

  // Memoized navigation handlers
  const handleNewApp = useCallback(() => {
    navigate('/chat/new');
  }, [navigate]);

  const handleNavigateToApp = useCallback((appId: string) => {
    navigate(`/app/${appId}`);
  }, [navigate]);

  const handleNavigateToTemplates = useCallback(() => {
    navigate('/templates');
  }, [navigate]);

  const handleNavigateToBoards = useCallback(() => {
    navigate('/boards');
  }, [navigate]);

  const handleNavigateToApps = useCallback(() => {
    navigate('/apps');
  }, [navigate]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-6 py-8 max-w-7xl space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back, {user?.displayName}!
            </h1>
            <p className="text-muted-foreground mt-1">
              Here's what's happening with your apps today
            </p>
          </div>
          <Button 
            size="lg"
            className="bg-gradient-to-r from-[#f48120] to-[#faae42] hover:from-[#faae42] hover:to-[#f48120] text-white shadow-lg transition-all hover:shadow-xl"
            onClick={handleNewApp}
          >
            <Plus className="mr-2 h-5 w-5" />
            Got an idea?
          </Button>
        </div>
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Apps</CardTitle>
              <div className="p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                <Code2 className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {appsLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalApps}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Total applications created
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                <Zap className="h-4 w-4 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeProjects}</div>
              <Progress value={75} className="h-1 mt-3" />
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <div className="p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                <Activity className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.favoriteCount}</div>
              <div className="text-xs text-muted-foreground mt-1">
                Favorite applications
              </div>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Teams</CardTitle>
              <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                <Users className="h-4 w-4 text-yellow-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.teamCount}</div>
              <div className="text-xs text-muted-foreground mt-1">Coming soon</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3 mx-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="apps">My Apps</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <Card className="lg:col-span-2 border-border/50">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest actions and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  {appsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentApps.length > 0 ? (
                    <div className="space-y-4">
                      {recentApps.map((app) => (
                        <div 
                          key={app.id} 
                          className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleNavigateToApp(app.id)}
                        >
                          <div className="p-2 rounded-lg bg-muted text-blue-500">
                            <Code2 className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{app.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatAppDate(app.updatedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">No recent activity yet</p>
                      <Button 
                        variant="link" 
                        className="mt-2"
                        onClick={handleNewApp}
                      >
                        Create your first app
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Get started quickly</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start hover:bg-muted"
                    onClick={handleNewApp}
                  >
                    <Sparkles className="mr-2 h-4 w-4 text-[#f48120]" />
                    Generate with AI
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start hover:bg-muted"
                    onClick={handleNavigateToTemplates}
                  >
                    <GitBranch className="mr-2 h-4 w-4 text-blue-500" />
                    Browse Templates
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start hover:bg-muted"
                    onClick={handleNavigateToBoards}
                  >
                    <Users className="mr-2 h-4 w-4 text-purple-500" />
                    Join a Board
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Top Apps */}
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Top Performing Apps</CardTitle>
                  <CardDescription>Your most popular applications</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={handleNavigateToApps}>
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {appsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : topApps.length > 0 ? (
                  <div className="space-y-4">
                    {topApps.map((app, index) => (
                      <div 
                        key={app.id} 
                        className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleNavigateToApp(app.id)}
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-lg font-bold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{app.title}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {app.framework}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            {app.isFavorite && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                Favorite
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {app.lastUpdated}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No apps created yet</p>
                    <Button 
                      variant="link" 
                      className="mt-2"
                      onClick={handleNewApp}
                    >
                      Create your first app
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apps">
            <Card className="border-border/50">
              <CardContent className="py-6">
                {appsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : apps.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {apps.map((app) => (
                      <AppCard
                        key={app.id}
                        app={app}
                        onClick={handleNavigateToApp}
                        formatDate={formatAppDate}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Apps Yet</h3>
                    <p className="text-muted-foreground text-center mb-6">
                      Start building your first application
                    </p>
                    <Button onClick={handleNewApp}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create App
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Activity Feed</h3>
                <p className="text-muted-foreground text-center">
                  Your detailed activity history will appear here
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}