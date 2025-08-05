import React from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Mail, 
  Calendar,
  Shield,
  Activity,
  Code2,
  Star,
  Trophy,
  Settings,
  Edit3,
  Save,
  X,
  Globe,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useUserStats, useUserActivity } from '@/hooks/use-stats';
import { useUserApps } from '@/hooks/use-apps';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = React.useState(false);
  const [profileData, setProfileData] = React.useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    timezone: user?.timezone || 'UTC'
  });
  const [isSaving, setIsSaving] = React.useState(false);

  // Update profile data when user changes
  React.useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.displayName || '',
        username: user.username || '',
        bio: user.bio || '',
        timezone: user.timezone || 'UTC'
      });
    }
  }, [user]);

  const { stats, loading: statsLoading } = useUserStats();
  const { activities = [], loading: activityLoading } = useUserActivity();
  const { apps: recentApps, loading: appsLoading } = useUserApps();

  // Transform achievements from stats
  const achievements = stats.achievements || [];

  const handleSave = async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('Profile updated successfully');
        // Refresh user data in auth context
        await refreshUser();
        setIsEditing(false);
      } else {
        toast.error(data.error?.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setProfileData({
      displayName: user?.displayName || '',
      username: user?.username || '',
      bio: user?.bio || '',
      timezone: user?.timezone || 'UTC'
    });
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-bg-light">
      {/* Profile Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="pb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <Avatar className="h-24 w-24 ring-4 ring-background shadow-xl">
              <AvatarImage src={user?.avatarUrl} />
              <AvatarFallback className="text-2xl bg-gradient-to-br from-[#f48120] to-[#faae42] text-white">
                {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold">{user?.displayName}</h1>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    {user?.provider === 'github' ? <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> : <Globe className="h-3 w-3" />}
                    {user?.provider}
                  </Badge>
                  {user?.emailVerified && (
                    <Badge variant="secondary" className="gap-1">
                      <Shield className="h-3 w-3" />
                      Verified
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground mb-1">{user?.email}</p>
              {user?.bio && <p className="text-sm max-w-2xl">{user.bio}</p>}
            </div>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button onClick={handleSave} size="sm" disabled={isSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={handleCancel} size="sm">
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)} size="sm">
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/settings')} size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="text-center hover:shadow-lg hover:scale-[1.02] transition-all dark:bg-card/50">
            <CardContent className="pt-6">
              <Code2 className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{statsLoading ? '-' : stats.totalApps}</p>
              <p className="text-xs text-muted-foreground">Total Apps</p>
            </CardContent>
          </Card>
          
          <Card className="text-center hover:shadow-lg hover:scale-[1.02] transition-all dark:bg-card/50">
            <CardContent className="pt-6">
              <Globe className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{statsLoading ? '-' : stats.publicApps}</p>
              <p className="text-xs text-muted-foreground">Public Apps</p>
            </CardContent>
          </Card>
          
          <Card className="text-center hover:shadow-lg hover:scale-[1.02] transition-all dark:bg-card/50">
            <CardContent className="pt-6">
              <Activity className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{statsLoading ? '-' : stats.totalViews}</p>
              <p className="text-xs text-muted-foreground">Total Views</p>
            </CardContent>
          </Card>
          
          <Card className="text-center hover:shadow-lg hover:scale-[1.02] transition-all dark:bg-card/50">
            <CardContent className="pt-6">
              <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">{statsLoading ? '-' : stats.totalLikes}</p>
              <p className="text-xs text-muted-foreground">Total Likes</p>
            </CardContent>
          </Card>
          
          <Card className="text-center hover:shadow-lg hover:scale-[1.02] transition-all dark:bg-card/50">
            <CardContent className="pt-6">
              <Trophy className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <p className="text-2xl font-bold">{statsLoading ? '-' : stats.achievements.length}</p>
              <p className="text-xs text-muted-foreground">Achievements</p>
            </CardContent>
          </Card>
          
          <Card className="text-center hover:shadow-lg hover:scale-[1.02] transition-all dark:bg-card/50">
            <CardContent className="pt-6">
              <Zap className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{statsLoading ? '-' : stats.streak}</p>
              <p className="text-xs text-muted-foreground">Day Streak</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="about" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4 mx-auto">
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="apps">Apps</TabsTrigger>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="space-y-6">
            <Card className="dark:bg-card/50">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  {isEditing ? 'Edit your profile information' : 'Your public profile information'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    {isEditing ? (
                      <Input
                        id="displayName"
                        value={profileData.displayName}
                        onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{user?.displayName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    {isEditing ? (
                      <Input
                        id="username"
                        value={profileData.username}
                        onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                        placeholder="@username"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{user?.username || 'Not set'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      {user?.email}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="joined">Member Since</Label>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {user?.createdAt ? format(new Date(user.createdAt), 'MMMM d, yyyy') : 'Unknown'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  {isEditing ? (
                    <Textarea
                      id="bio"
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      placeholder="Tell us about yourself..."
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {user?.bio || 'No bio provided'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apps">
            <Card className="dark:bg-card/50">
              <CardHeader>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>Your latest created applications</CardDescription>
              </CardHeader>
              <CardContent>
                {appsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                      <p className="text-sm text-muted-foreground">Loading apps...</p>
                    </div>
                  </div>
                ) : recentApps && recentApps.length > 0 ? (
                  <div className="space-y-4">
                    {recentApps.slice(0, 5).map((app) => (
                      <div 
                        key={app.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/app/${app.id}`)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                            <Code2 className="h-6 w-6" />
                          </div>
                          <div>
                            <h4 className="font-medium">{app.title}</h4>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                {app.framework}
                              </Badge>
                              <span className="text-xs">
                                {app.createdAt ? format(new Date(app.createdAt), 'MMM d, yyyy') : 'Recently'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={app.visibility === 'public' ? 'default' : 'secondary'}>
                          {app.visibility}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Code2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No apps created yet</p>
                    <Button className="mt-4" onClick={() => navigate('/chat')}>
                      Create Your First App
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="achievements">
            <Card className="dark:bg-card/50">
              <CardHeader>
                <CardTitle>Achievements</CardTitle>
                <CardDescription>Your earned badges and milestones</CardDescription>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                      <p className="text-sm text-muted-foreground">Loading achievements...</p>
                    </div>
                  </div>
                ) : achievements && achievements.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {achievements.map((achievement, index) => {
                      const Icon = achievement.icon || Trophy;
                      return (
                        <div key={achievement.id || index} className="p-4 rounded-lg border hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-4">
                            <div className={cn("p-3 rounded-lg", achievement.color || "bg-muted text-muted-foreground")}>
                              <Icon className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{achievement.name}</h4>
                              <p className="text-sm text-muted-foreground mt-1">
                                {achievement.description}
                              </p>
                              {achievement.unlockedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Unlocked {format(new Date(achievement.unlockedAt), 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No achievements yet</p>
                    <p className="text-sm text-muted-foreground mt-2">Start creating apps to unlock achievements!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card className="dark:bg-card/50">
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>Your recent activity and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                      <p className="text-sm text-muted-foreground">Loading activity...</p>
                    </div>
                  </div>
                ) : activities && activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((activity, index) => (
                      <div key={index} className="flex items-start gap-4 pb-4 border-b last:border-0">
                        <div className={cn(
                          "p-2 rounded-lg",
                          activity.type === 'created' && "bg-green-500/10 text-green-600",
                          activity.type === 'updated' && "bg-blue-500/10 text-blue-600",
                          activity.type === 'favorited' && "bg-yellow-500/10 text-yellow-600"
                        )}>
                          {activity.type === 'created' && <Zap className="h-4 w-4" />}
                          {activity.type === 'updated' && <Edit3 className="h-4 w-4" />}
                          {activity.type === 'favorited' && <Star className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">
                              {activity.type === 'created' && 'Created'}
                              {activity.type === 'updated' && 'Updated'}
                              {activity.type === 'favorited' && 'Favorited'}
                            </span>
                            {' '}
                            <span className="text-muted-foreground">{activity.title}</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {activity.timestamp ? format(new Date(activity.timestamp), 'MMM d, yyyy h:mm a') : 'Recently'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}