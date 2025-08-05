import React from 'react';
import { 
  Home, 
  History, 
  Star, 
  Users, 
  Settings,
  Plus,
  ChevronRight,
  Search,
  Code2,
  Globe,
  Lock,
  Users2,
  LayoutGrid,
  Compass
} from 'lucide-react';
import './sidebar-overrides.css';
import { useRecentApps, useFavoriteApps, toggleFavorite } from '@/hooks/use-apps';
import { CloudflareLogo } from '../icons/logos';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarSeparator,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/auth-context';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface App {
  id: string;
  title: string;
  framework?: string;
  updatedAt: string;
  visibility: 'private' | 'team' | 'board' | 'public';
  isFavorite?: boolean;
}

interface Board {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  appCount: number;
  iconUrl?: string | null;
}

export function AppSidebar() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [expandedGroups, setExpandedGroups] = React.useState<string[]>(['apps', 'boards']);
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === 'collapsed';
  
  // Fetch real data from API
  const { apps: recentApps, refetch: refetchRecent, loading: recentLoading, error: recentError } = useRecentApps();
  const { apps: favoriteApps, refetch: refetchFavorites } = useFavoriteApps();
  
  // Debug logging
  React.useEffect(() => {
    console.log('Sidebar - Recent apps:', recentApps);
    console.log('Sidebar - Loading:', recentLoading);
    console.log('Sidebar - Error:', recentError);
  }, [recentApps, recentLoading, recentError]);
  
  const boards: Board[] = []; // Remove mock boards

  const getFrameworkIcon = (framework?: string) => {
    switch (framework) {
      case 'react':
        return <Code2 className="h-4 w-4 text-blue-500" />;
      case 'vue':
        return <Code2 className="h-4 w-4 text-green-500" />;
      case 'svelte':
        return <Code2 className="h-4 w-4 text-orange-500" />;
      default:
        return <Code2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getVisibilityIcon = (visibility: App['visibility']) => {
    switch (visibility) {
      case 'private':
        return <Lock className="h-3 w-3" />;
      case 'team':
        return <Users2 className="h-3 w-3" />;
      case 'board':
        return <Globe className="h-3 w-3" />;
      case 'public':
        return <Globe className="h-3 w-3" />;
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => 
      prev.includes(group) 
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };


  return (
    <>
      
      <Sidebar 
        collapsible="icon" 
        className={cn(
          "border-r bg-sidebar transition-all duration-300 ease-in-out",
          !isCollapsed && "shadow-xl"
        )}
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton 
                size="lg" 
                asChild 
                tooltip="v1.dev"
                className="logo-button"
              >
                <a href="/dashboard" className="flex items-center gap-3">
                  <CloudflareLogo 
                    className="text-[#f48120] flex-shrink-0 transition-all duration-300"
                    style={{
                      width: isCollapsed ? '32px' : '64px',
                      height: isCollapsed ? '32px' : '64px'
                    }}
                  />
                  {!isCollapsed && (
                    <div className="grid text-left leading-tight">
                      <span className="truncate font-bold text-lg">v1.dev</span>
                    </div>
                  )}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* Build Button */}
          <SidebarGroup>
            <SidebarGroupContent>
              <div className={cn("pb-2", isCollapsed ? "" : "px-3")}>
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        className={cn(
                          "bg-gradient-to-r from-[#f48120] to-[#faae42] hover:from-[#faae42] hover:to-[#f48120] text-white shadow-md transition-all hover:shadow-lg",
                          isCollapsed ? "create-button" : "w-full"
                        )}
                        onClick={() => navigate('/')}
                        size={isCollapsed ? "icon" : "default"}
                      >
                        <Plus className="h-4 w-4" />
                        {!isCollapsed && <span className="ml-2">Got an idea?</span>}
                      </Button>
                    </TooltipTrigger>
                    {isCollapsed && (
                      <TooltipContent side="right" className="ml-2">
                        Got an idea?
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Search */}
          <SidebarGroup className="py-0">
            <SidebarGroupContent>
              {isCollapsed ? (
                <div className="pb-2">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-full h-10 search-button"
                          onClick={() => {
                            setOpen(true);
                            setTimeout(() => {
                              const searchInput = document.querySelector('input[placeholder="Search apps..."]') as HTMLInputElement;
                              searchInput?.focus();
                            }, 300);
                          }}
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="ml-2">
                        Search apps
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : (
                <div className="px-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search apps..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-full pl-8"
                    />
                  </div>
                </div>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          <ScrollArea className="flex-1">
            {/* Navigation */}
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/')} 
                    tooltip="Home"
                    className="nav-button"
                  >
                    <Home className="h-4 w-4" />
                    {!isCollapsed && <span>Home</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/dashboard')} 
                    tooltip="Dashboard"
                    className="nav-button"
                  >
                    <LayoutGrid className="h-4 w-4" />
                    {!isCollapsed && <span>Dashboard</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => navigate('/discover')} 
                    tooltip="Discover"
                    className="nav-button"
                  >
                    <Compass className="h-4 w-4" />
                    {!isCollapsed && <span>Discover</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>

            <SidebarSeparator />

            {/* Recent Apps */}
            <SidebarGroup>
              <SidebarGroupLabel 
                className={cn(
                  "flex items-center cursor-pointer hover:text-foreground transition-colors",
                  isCollapsed ? "justify-center px-0" : "justify-between"
                )}
                onClick={() => toggleGroup('apps')}
              >
                {isCollapsed ? (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger>
                        <History className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="ml-2">
                        Recent Apps
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      <span>Recent Apps</span>
                    </div>
                    <ChevronRight 
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedGroups.includes('apps') && "rotate-90"
                      )}
                    />
                  </>
                )}
              </SidebarGroupLabel>
              {expandedGroups.includes('apps') && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {recentApps.map((app) => (
                      <SidebarMenuItem key={app.id}>
                        <SidebarMenuButton 
                          onClick={() => navigate(`/app/${app.id}`)}
                          tooltip={app.title}
                          className="group app-item-button"
                        >
                          <div className={cn(
                            "rounded-lg flex-shrink-0 flex items-center justify-center transition-colors",
                            "h-8 w-8",
                            isCollapsed ? "bg-sidebar-accent" : "bg-sidebar-accent/50"
                          )}>
                            {getFrameworkIcon(app.framework)}
                          </div>
                          {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-sm">{app.title}</span>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  {getVisibilityIcon(app.visibility)}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{app.updatedAt}</p>
                            </div>
                          )}
                        </SidebarMenuButton>
                        {!isCollapsed && (
                          <SidebarMenuAction>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (token) {
                                  try {
                                    await toggleFavorite(app.id);
                                    refetchRecent();
                                    refetchFavorites();
                                  } catch (error) {
                                    console.error('Failed to toggle favorite:', error);
                                  }
                                }
                              }}
                            >
                              <Star 
                                className={cn(
                                  "h-3 w-3 transition-colors",
                                  app.isFavorite ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground hover:text-yellow-500"
                                )}
                              />
                            </Button>
                          </SidebarMenuAction>
                        )}
                      </SidebarMenuItem>
                    ))}
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={() => navigate('/apps')}
                        tooltip="View all apps"
                        className="text-muted-foreground hover:text-foreground view-all-button"
                      >
                        <ChevronRight className="h-4 w-4" />
                        {!isCollapsed && <span className="text-sm">View all apps →</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>

            {/* Favorites */}
            {favoriteApps.length > 0 && (
              <>
                <SidebarSeparator />
                <SidebarGroup>
                  <SidebarGroupLabel className={cn(
                    "flex items-center gap-2",
                    isCollapsed && "justify-center px-0"
                  )}>
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                    {!isCollapsed && 'Favorites'}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {favoriteApps.map((app) => (
                        <SidebarMenuItem key={app.id}>
                          <SidebarMenuButton 
                            onClick={() => navigate(`/app/${app.id}`)} 
                            tooltip={app.title}
                            className="favorite-item-button"
                          >
                            {getFrameworkIcon(app.framework)}
                            {!isCollapsed && <span className="truncate">{app.title}</span>}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </>
            )}

            {/* Boards */}
            {boards.length > 0 && (
              <>
                <SidebarSeparator />
                <SidebarGroup>
              <SidebarGroupLabel 
                className={cn(
                  "flex items-center cursor-pointer hover:text-foreground transition-colors",
                  isCollapsed ? "justify-center px-0" : "justify-between"
                )}
                onClick={() => toggleGroup('boards')}
              >
                {isCollapsed ? (
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger>
                        <Users className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="ml-2">
                        My Boards
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>My Boards</span>
                    </div>
                    <ChevronRight 
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedGroups.includes('boards') && "rotate-90"
                      )}
                    />
                  </>
                )}
              </SidebarGroupLabel>
              {expandedGroups.includes('boards') && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {boards.map((board) => (
                      <SidebarMenuItem key={board.id}>
                        <SidebarMenuButton 
                          onClick={() => navigate(`/boards/${board.slug}`)}
                          tooltip={board.name}
                          className="board-item-button"
                        >
                          <div className={cn(
                            "rounded-lg flex-shrink-0 flex items-center justify-center transition-colors",
                            "h-8 w-8",
                            isCollapsed ? "bg-sidebar-accent" : "bg-sidebar-accent/50"
                          )}>
                            <Users2 className="h-4 w-4 text-sidebar-accent-foreground" />
                          </div>
                          {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{board.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {board.memberCount} members • {board.appCount} apps
                              </p>
                            </div>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                    <SidebarMenuItem>
                      <SidebarMenuButton 
                        onClick={() => navigate('/boards')}
                        tooltip="Browse all boards"
                        className="text-muted-foreground hover:text-foreground view-all-button"
                      >
                        <Plus className="h-4 w-4" />
                        {!isCollapsed && <span className="text-sm ml-2">Browse all boards</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
                </SidebarGroup>
              </>
            )}
          </ScrollArea>
        </SidebarContent>

        <SidebarFooter>
          {user && (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => navigate('/profile')}
                  size="lg"
                  tooltip={user.displayName || user.email}
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground profile-button"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback className="bg-gradient-to-br from-[#f48120] to-[#faae42] text-white">
                      {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.displayName || user.email}</span>
                      <span className="truncate text-xs">{user.email}</span>
                    </div>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => navigate('/settings')} 
                  tooltip="Settings"
                  className="settings-button"
                >
                  <Settings className="h-4 w-4" />
                  {!isCollapsed && <span>Settings</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarFooter>
      </Sidebar>
    </>
  );
}