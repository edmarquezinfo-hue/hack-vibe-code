import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Loader2
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

// Reusable components to eliminate duplicate JSX
const StatItem = ({ icon: Icon, value, highlighted = false }: { 
  icon: LucideIcon; 
  value: number; 
  highlighted?: boolean; 
}) => (
  <div className="flex items-center gap-1">
    <Icon className={cn("h-3.5 w-3.5", highlighted && "fill-yellow-500 text-yellow-500")} />
    <span>{value || 0}</span>
  </div>
);

const StatsDisplay = ({ stats }: { stats: StatsData }) => (
  <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

const DeploymentBadge = ({ app, showUser }: { app: AppCardData; showUser: boolean }) => {
  // Only show on My Apps page (when showUser is false)
  if (showUser) return null;
  
  const deploymentStatus = getDeploymentStatusInfo(app);
  if (!deploymentStatus) return null;
  
  const IconComponent = deploymentStatus.icon;
  return (
    <div className={cn(
      "flex items-center gap-1 px-2 py-1 rounded-md backdrop-blur-sm text-xs font-medium",
      deploymentStatus.bgColor,
      deploymentStatus.color
    )}>
      <IconComponent 
        className={cn(
          "h-3 w-3",
          deploymentStatus.animate && "animate-spin"
        )} 
      />
      <span className="hidden sm:inline">{deploymentStatus.text}</span>
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
        className="h-full hover:shadow-lg transition-all duration-200 cursor-pointer group"
        onClick={() => onClick(app.id)}
      >
        {/* Preview Image or Placeholder */}
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

          {/* Badges for User Apps - Visibility and Deployment Status */}
          {(isUserApp(app) || isEnhancedApp(app)) && (
            <div className="absolute top-2 left-2 flex items-center gap-1">
              {/* Visibility Badge */}
              <div className="bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-md p-1">
                {getVisibilityIcon(app.visibility)}
              </div>
              
              {/* Deployment Status Badge - only for My Apps (not Discover) */}
              <DeploymentBadge app={app} showUser={showUser} />
            </div>
          )}
        </div>

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-orange-600 transition-colors">
              {app.title}
            </h3>
            
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
          {/* User Info - for public apps */}
          {showUser && isPublicApp(app) && (
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
                    <AvatarImage src={app.userAvatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {app.userName?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-muted-foreground">{app.userName}</span>
                </div>
              )}
              <span className="text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">
                {app.createdAt ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true }) : 'Recently'}
              </span>
            </div>
          )}

          {/* Time info for user apps */}
          {!showUser && (isUserApp(app) || isEnhancedApp(app)) && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">
                Updated {
                  isUserApp(app) ? app.updatedAtFormatted : 
                  isEnhancedApp(app) && app.updatedAt ? formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true }) : 
                  'Recently'
                }
              </span>
            </div>
          )}

          {/* Stats - show for public apps or user apps with stats */}
          {showStats && <StatsDisplay stats={getAppStats(app)} />}
        </CardContent>
      </Card>
    </motion.div>
  );
});

AppCard.displayName = 'AppCard';