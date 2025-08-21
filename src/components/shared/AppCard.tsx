import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Star, 
  Eye, 
  GitBranch, 
  Code2, 
  User, 
  Lock, 
  Users2, 
  Globe,
  Bookmark,
  Cloud,
  CloudOff,
  Loader2,
  ExternalLink,
  Github
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { AppWithFavoriteStatus, AppWithUserAndStats, EnhancedAppData } from '@/api-types';
import { AppActionsDropdown } from './AppActionsDropdown';
import type { LucideIcon } from 'lucide-react';

// Union type for both app types - make updatedAtFormatted optional
type AppCardData = AppWithFavoriteStatus | (EnhancedAppData & { updatedAtFormatted?: string }) | AppWithUserAndStats;

// Type definitions for deployment and stats
type DeploymentStatus = 'none' | 'deploying' | 'deployed' | 'failed';

interface AppWithDeployment {
  deploymentStatus?: DeploymentStatus;
  deploymentUrl?: string;
}

interface DeploymentStatusInfo {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  text: string;
  animate?: boolean;
}

interface StatsData {
  viewCount?: number;
  starCount?: number;
  forkCount?: number;
  userStarred?: boolean;
}

// Layout and design types for enhanced UI
type CardLayout = 'compact' | 'detailed';

interface LayoutConfig {
  layout: CardLayout;
  showUserInfo: boolean;
  primaryMetadata: 'deployment' | 'social' | 'timestamp';
  showDeploymentStatus: boolean;
}

// Constants - Single source of truth for deployment status configurations
const DEPLOYMENT_STATUS_CONFIG: Record<DeploymentStatus, DeploymentStatusInfo> = {
  deployed: {
    icon: Cloud,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    text: ''
  },
  deploying: {
    icon: Loader2,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    text: 'Deploying',
    animate: true
  },
  failed: {
    icon: CloudOff,
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    text: 'Deploy Failed'
  },
  none: {
    icon: CloudOff,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    text: 'Not Deployed'
  }
};

// Stats icons mapping
const STATS_ICONS = {
  viewCount: Eye,
  starCount: Star,
  forkCount: GitBranch
} as const;

// Type-safe utility functions
function hasDeploymentFields(app: AppCardData): app is AppCardData & AppWithDeployment {
  return 'deploymentStatus' in app || 'deploymentUrl' in app;
}

function getAppDeploymentStatus(app: AppCardData): DeploymentStatus {
  if (!hasDeploymentFields(app)) return 'none';
  
  // If has deployment URL, it's deployed
  if (app.deploymentUrl) return 'deployed';
  
  // Return deployment status or default to 'none'
  return app.deploymentStatus || 'none';
}

function getAppStats(app: AppCardData): StatsData {
  if (isPublicApp(app)) {
    return {
      viewCount: app.viewCount,
      starCount: app.starCount,
      forkCount: app.forkCount,
      userStarred: app.userStarred
    };
  }
  
  if (isUserApp(app) || isEnhancedApp(app)) {
    // Type-safe access to stats fields that exist on enhanced/user app types
    const enhancedApp = app as EnhancedAppData;
    return {
      viewCount: enhancedApp.viewCount,
      starCount: enhancedApp.starCount,
      forkCount: enhancedApp.forkCount,
      userStarred: enhancedApp.userStarred
    };
  }
  
  return {};
}

// Type guards
function isPublicApp(app: AppCardData): app is AppWithUserAndStats {
  return 'userName' in app && 'starCount' in app && 'userStarred' in app && 'updatedAtFormatted' in app;
}

function isUserApp(app: AppCardData): app is AppWithFavoriteStatus {
  return 'isFavorite' in app && 'updatedAtFormatted' in app && !('userName' in app);
}

function isEnhancedApp(app: AppCardData): app is EnhancedAppData {
  return 'userFavorited' in app && 'starCount' in app && !('isFavorite' in app) && !('updatedAtFormatted' in app);
}

interface AppCardProps {
  app: AppCardData;
  onClick: (appId: string) => void;
  onToggleFavorite?: (appId: string) => void;
  showStats?: boolean;
  showUser?: boolean;
  showActions?: boolean;
  className?: string;
}

const getVisibilityIcon = (visibility: string) => {
  switch (visibility) {
    case 'private':
      return <Lock className="h-3 w-3" />;
    case 'team':
      return <Users2 className="h-3 w-3" />;
    case 'board':
    case 'public':
      return <Globe className="h-3 w-3" />;
    default:
      return <Lock className="h-3 w-3" />;
  }
};

function getDeploymentStatusInfo(app: AppCardData): DeploymentStatusInfo | null {
  if (!hasDeploymentFields(app)) return null;
  
  const status = getAppDeploymentStatus(app);
  return DEPLOYMENT_STATUS_CONFIG[status];
}

function getLayoutConfig(showUser: boolean, showActions: boolean): LayoutConfig {
  return {
    layout: showUser ? 'detailed' : 'compact',
    showUserInfo: showUser,
    primaryMetadata: showUser ? 'social' : 'deployment',
    showDeploymentStatus: !showUser && showActions
  };
}

// Reusable components to eliminate duplicate JSX
const StatItem = ({ icon: Icon, value, highlighted = false }: { 
  icon: LucideIcon; 
  value: number; 
  highlighted?: boolean; 
}) => (
  <div className="flex items-center gap-1 group-hover:scale-105 transition-transform duration-200">
    <Icon className={cn(
      "h-3.5 w-3.5 transition-all duration-200", 
      highlighted && "fill-yellow-500 text-yellow-500 drop-shadow-sm",
      !highlighted && "group-hover:text-muted-foreground"
    )} />
    <span className="font-medium text-xs">{value || 0}</span>
  </div>
);

const StatsDisplay = ({ stats }: { stats: StatsData }) => (
  <div className="flex items-center gap-4 text-sm text-muted-foreground/80">
    <StatItem 
      icon={STATS_ICONS.viewCount} 
      value={stats.viewCount || 0} 
    />
    <StatItem 
      icon={STATS_ICONS.starCount} 
      value={stats.starCount || 0} 
      highlighted={stats.userStarred} 
    />
    <StatItem 
      icon={STATS_ICONS.forkCount} 
      value={stats.forkCount || 0} 
    />
  </div>
);


// Enhanced metadata component that adapts to layout
const AdaptiveMetadata = ({ app, layoutConfig, hasOverlayStatus }: { 
  app: AppCardData; 
  layoutConfig: LayoutConfig; 
  hasOverlayStatus?: boolean;
}) => {
  if (layoutConfig.primaryMetadata === 'social' && isPublicApp(app)) {
    // Discover page layout - show user info
    return (
      <div className="flex items-center gap-2.5 text-sm">
        {app.userName === 'Anonymous User' ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-5 w-5 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-sm">
              <User className="h-2.5 w-2.5 text-white" />
            </div>
            <span className="text-xs font-medium">Anonymous User</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5 ring-1 ring-border/10">
              <AvatarImage src={app.userAvatar || undefined} />
              <AvatarFallback className="text-[10px] bg-gradient-to-br from-orange-200 to-orange-300 font-semibold">
                {app.userName?.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground font-medium hover:text-foreground transition-colors">{app.userName}</span>
          </div>
        )}
        <span className="text-muted-foreground/60">•</span>
        <span className="text-xs text-muted-foreground/80 font-medium">
          {app.createdAt ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true }) : 'Recently'}
        </span>
      </div>
    );
  }
  
  if (layoutConfig.primaryMetadata === 'deployment' && (isUserApp(app) || isEnhancedApp(app))) {
    // My Apps page layout - show deployment status and update time
    const deploymentStatus = getDeploymentStatusInfo(app);
    return (
      <div className="flex items-center gap-2.5 text-sm">
        {/* Only show deployment status if there's no overlay status indicator */}
        {deploymentStatus && !hasOverlayStatus && (
          <>
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                deploymentStatus.color === 'text-green-600' && "bg-green-500 shadow-sm shadow-green-500/20",
                deploymentStatus.color === 'text-orange-600' && "bg-orange-500 animate-pulse shadow-sm shadow-orange-500/20",
                deploymentStatus.color === 'text-red-600' && "bg-red-500 shadow-sm shadow-red-500/20",
                deploymentStatus.color === 'text-gray-500' && "bg-gray-400"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                deploymentStatus.color === 'text-green-600' && "text-green-600",
                deploymentStatus.color === 'text-orange-600' && "text-orange-600", 
                deploymentStatus.color === 'text-red-600' && "text-red-600",
                deploymentStatus.color === 'text-gray-500' && "text-muted-foreground"
              )}>
                {deploymentStatus.text}
              </span>
            </div>
            <span className="text-muted-foreground/60">•</span>
          </>
        )}
        <span className="text-xs text-muted-foreground/80 font-medium">
          Updated {
            isUserApp(app) ? app.updatedAtFormatted : 
            isEnhancedApp(app) && app.updatedAt ? formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true }) : 
            'Recently'
          }
        </span>
      </div>
    );
  }
  
  // Fallback for other cases
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-xs text-muted-foreground/80 font-medium">
        {isUserApp(app) ? `Updated ${app.updatedAtFormatted}` : 'Recently updated'}
      </span>
    </div>
  );
};

export const AppCard = React.memo<AppCardProps>(({ 
  app, 
  onClick, 
  onToggleFavorite,
  showStats = true,
  showUser = false,
  showActions = false,
  className 
}) => {
  const layoutConfig = getLayoutConfig(showUser, showActions);
  const deploymentStatus = getDeploymentStatusInfo(app);
  
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      onToggleFavorite(app.id);
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
    },
    exit: {
      y: -20,
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <motion.div 
      variants={itemVariants} 
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={className}
    >
      <Card 
        className={cn(
          "h-full transition-all duration-300 ease-out cursor-pointer group relative overflow-hidden",
          "hover:shadow-xl hover:shadow-black/8 hover:-translate-y-1",
          "border border-border/40 hover:border-border/60",
          // Status-aware enhancements with subtle gradients
          deploymentStatus?.color === 'text-green-600' && "hover:shadow-green-500/20 hover:border-green-200/30 hover:bg-gradient-to-br hover:from-green-50/30 hover:to-transparent dark:hover:from-green-950/20",
          deploymentStatus?.color === 'text-orange-600' && "hover:shadow-orange-500/20 hover:border-orange-200/30 hover:bg-gradient-to-br hover:from-orange-50/30 hover:to-transparent dark:hover:from-orange-950/20",
          deploymentStatus?.color === 'text-red-600' && "hover:shadow-red-500/20 hover:border-red-200/30 hover:bg-gradient-to-br hover:from-red-50/30 hover:to-transparent dark:hover:from-red-950/20",
          // Default enhanced styling
          !deploymentStatus && "hover:bg-gradient-to-br hover:from-orange-50/20 hover:to-transparent dark:hover:from-orange-950/10"
        )}
        onClick={() => onClick(app.id)}
      >
        {/* Enhanced Preview Section */}
        <div className="relative h-48 bg-gradient-to-br from-orange-50 to-orange-100 overflow-hidden">
          {app.screenshotUrl ? (
            <img 
              src={app.screenshotUrl} 
              alt={`${app.title} preview`}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling as HTMLElement;
                if (placeholder) {
                  placeholder.classList.remove('hidden');
                }
              }}
            />
          ) : null}
          
          {/* Fallback placeholder - hidden when screenshot exists */}
          <div className={cn(
            "w-full h-full flex items-center justify-center absolute inset-0",
            app.screenshotUrl ? "hidden" : ""
          )}>
            <Code2 className="h-16 w-16 text-orange-300" />
          </div>
          
          {/* Enhanced status indicator for deployed apps - transforms from dot to share button on hover */}
          {deploymentStatus?.color === 'text-green-600' && (
            <button
              className="absolute top-2 left-2 group/status h-5 w-5 hover:h-6 hover:w-6 rounded-full bg-green-600/70 backdrop-blur-sm hover:bg-green-700/80 transition-all duration-300 ease-out flex items-center justify-center shadow-sm hover:shadow-lg border border-green-500/15 hover:border-green-400/25"
              onClick={(e) => {
                e.stopPropagation();
                if (hasDeploymentFields(app) && app.deploymentUrl) {
                  window.open(app.deploymentUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              title="Open deployed app"
              aria-label="Open deployed app in new tab"
            >
              {/* Subtle dot indicator - visible by default */}
              <div className="w-1.5 h-1.5 bg-white/80 rounded-full animate-pulse group-hover/status:opacity-0 transition-opacity duration-200" />
              
              {/* Share icon - visible on hover */}
              <ExternalLink className="w-3 h-3 text-white/90 opacity-0 group-hover/status:opacity-100 transition-all duration-200 absolute" />
            </button>
          )}
          
          {/* Deploying status indicator - simple loader dot without text */}
          {deploymentStatus?.color === 'text-orange-600' && (
            <div 
              className="absolute top-2 left-2 h-5 w-5 hover:h-6 hover:w-6 rounded-full bg-orange-600/70 backdrop-blur-sm transition-all duration-300 ease-out flex items-center justify-center shadow-sm hover:shadow-lg hover:bg-orange-700/80 border border-orange-500/15 hover:border-orange-400/25"
              title="App is deploying"
              aria-label="App deployment in progress"
            >
              <Loader2 className="w-2.5 h-2.5 text-white/80 animate-spin" />
            </div>
          )}
          
          {/* Failed deployment status indicator */}
          {deploymentStatus?.color === 'text-red-600' && (
            <div 
              className="absolute top-2 left-2 h-5 w-5 hover:h-6 hover:w-6 rounded-full bg-red-600/70 backdrop-blur-sm transition-all duration-300 ease-out flex items-center justify-center shadow-sm hover:shadow-lg hover:bg-red-700/80 border border-red-500/15 hover:border-red-400/25"
              title="Deployment failed"
              aria-label="App deployment failed"
            >
              <CloudOff className="w-2.5 h-2.5 text-white/80" />
            </div>
          )}
          
          {/* GitHub Repository Badge - positioned in top-right when repository exists */}
          {app.githubRepositoryUrl && (
            <button
              className="absolute top-2 right-12 group/github h-6 w-6 hover:h-7 hover:w-7 rounded-full bg-gray-800/80 hover:bg-gray-900/90 backdrop-blur-sm transition-all duration-300 ease-out flex items-center justify-center shadow-sm hover:shadow-lg border border-gray-600/20 hover:border-gray-500/30"
              onClick={(e) => {
                e.stopPropagation();
                if (app.githubRepositoryUrl) {
                  window.open(app.githubRepositoryUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              title={`View on GitHub (${app.githubRepositoryVisibility || 'public'})`}
              aria-label="View repository on GitHub"
            >
              <Github className="w-3 h-3 text-white/90 group-hover/github:w-3.5 group-hover/github:h-3.5 transition-all duration-200" />
              {/* Private repository indicator */}
              {app.githubRepositoryVisibility === 'private' && (
                <Lock className="w-1.5 h-1.5 text-white/70 absolute -bottom-0.5 -right-0.5 bg-gray-800 rounded-full p-0.5" />
              )}
            </button>
          )}

          {/* Actions Dropdown - positioned in top-right on hover */}
          {showActions && (
            <div className="absolute top-2 right-2">
              <AppActionsDropdown
                appId={app.id}
                appTitle={app.title}
                showOnHover={true}
                className="h-6 w-6 text-muted-foreground hover:text-foreground bg-background/90 backdrop-blur-sm hover:bg-background"
                size="sm"
              />
            </div>
          )}

          {/* Visibility Badge for user apps (when not showing status overlays) */}
          {(isUserApp(app) || isEnhancedApp(app)) && !deploymentStatus && (
            <div className="absolute bottom-2 left-2 bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-md p-1">
              {getVisibilityIcon(app.visibility)}
            </div>
          )}
          
          {/* Visibility Badge positioned differently when status overlay exists */}
          {(isUserApp(app) || isEnhancedApp(app)) && deploymentStatus && (
            <div className="absolute bottom-2 left-2 bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-md p-1">
              {getVisibilityIcon(app.visibility)}
            </div>
          )}
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-orange-600 transition-all duration-200 ease-out group-hover:translate-x-0.5 mb-2">
                {app.title}
              </h3>
              
              {/* Enhanced Adaptive Metadata - replaces old separate sections */}
              <div className="transition-all duration-200 ease-out group-hover:translate-x-0.5">
                <AdaptiveMetadata 
                  app={app} 
                  layoutConfig={layoutConfig} 
                  hasOverlayStatus={!!deploymentStatus && deploymentStatus.color !== 'text-gray-500'}
                />
              </div>
            </div>
            
            {/* Favorite/Star Button */}
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={handleFavoriteClick}
              >
                {isUserApp(app) ? (
                  <Bookmark 
                    className={cn(
                      "h-4 w-4 transition-colors",
                      app.isFavorite ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground hover:text-yellow-500"
                    )}
                  />
                ) : isPublicApp(app) ? (
                  <Star 
                    className={cn(
                      "h-4 w-4 transition-colors",
                      app.userStarred ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground hover:text-yellow-500"
                    )}
                  />
                ) : null}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Stats - show for public apps or user apps with stats */}
          {showStats && <StatsDisplay stats={getAppStats(app)} />}
        </CardContent>
      </Card>
    </motion.div>
  );
});

AppCard.displayName = 'AppCard';