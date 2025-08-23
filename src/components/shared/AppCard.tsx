import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Star, 
  Eye, 
  Shuffle, 
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
import { useAuthGuard } from '../../hooks/useAuthGuard';

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
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950',
    text: 'Deployed'
  },
  deploying: {
    icon: Loader2,
    color: 'text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    text: 'Deploying',
    animate: true
  },
  failed: {
    icon: CloudOff,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
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
  forkCount: Shuffle
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
                deploymentStatus.color === 'text-green-500' && "bg-green-500 shadow-sm shadow-green-500/20",
                deploymentStatus.color === 'text-green-400' && "bg-green-400 animate-pulse shadow-sm shadow-green-400/20",
                deploymentStatus.color === 'text-gray-500' && "bg-gray-400 shadow-sm shadow-gray-400/20",
                deploymentStatus.color === 'text-gray-500' && "bg-gray-400"
              )} />
              <span className={cn(
                "text-xs font-medium transition-colors",
                deploymentStatus.color === 'text-green-500' && "text-green-600",
                deploymentStatus.color === 'text-green-400' && "text-green-600", 
                deploymentStatus.color === 'text-gray-500' && "text-gray-600",
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
  const { requireAuth } = useAuthGuard();
  const layoutConfig = getLayoutConfig(showUser, showActions);
  const deploymentStatus = getDeploymentStatusInfo(app);
  
  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleFavorite) {
      // Check authentication before allowing favorite/star action
      const actionContext = isUserApp(app) ? 'to bookmark this app' : 'to star this app';
      if (requireAuth({ 
        requireFullAuth: true, 
        actionContext 
      })) {
        onToggleFavorite(app.id);
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
          deploymentStatus?.color === 'text-green-500' && "hover:shadow-green-500/15 hover:border-green-200/25 hover:bg-gradient-to-br hover:from-green-50/20 hover:to-transparent dark:hover:from-green-950/15",
          deploymentStatus?.color === 'text-green-400' && "hover:shadow-green-400/15 hover:border-green-200/25 hover:bg-gradient-to-br hover:from-green-50/20 hover:to-transparent dark:hover:from-green-950/15",
          deploymentStatus?.color === 'text-gray-500' && "hover:shadow-gray-400/15 hover:border-gray-200/25 hover:bg-gradient-to-br hover:from-gray-50/20 hover:to-transparent dark:hover:from-gray-950/15",
          // Default enhanced styling
          !deploymentStatus && "hover:bg-gradient-to-br hover:from-orange-50/20 hover:to-transparent dark:hover:from-orange-950/10"
        )}
        onClick={() => onClick(app.id)}
      >
        {/* Enhanced Preview Section with High-Quality Rendering */}
        <div className="relative aspect-[16/9] bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 overflow-hidden rounded-t-lg">
          {app.screenshotUrl ? (
            <img 
              src={app.screenshotUrl} 
              alt={`${app.title} preview`}
              className={cn(
                "w-full h-full transition-all duration-300 ease-out",
                // High-quality rendering with smart cropping for better visual appeal
                "object-cover object-center",
                // Advanced cross-browser image rendering optimizations
                "[image-rendering:auto]",
                "[image-rendering:-webkit-optimize-contrast]",
                "[image-rendering:crisp-edges]",
                "[image-rendering:high-quality]",
                "[image-rendering:pixelated]",
                // Premium quality filters with advanced sharpening
                "contrast-[1.04] saturate-[1.05] brightness-[1.02]",
                "[filter:contrast(1.04)_saturate(1.05)_brightness(1.02)_unsharp-mask(0.5px_0.5px_0px)]",
                // GPU acceleration and performance optimizations
                "[will-change:transform]",
                "[transform:translate3d(0,0,0)]",
                "[backface-visibility:hidden]",
                "[contain:layout_style_paint]",
                "[isolation:isolate]",
                // Enhanced text and subpixel rendering
                "[-webkit-font-smoothing:subpixel-antialiased]",
                "[text-rendering:optimizeLegibility]",
                "[font-feature-settings:'kern'_1]",
                // Smooth scaling and interaction with enhanced quality
                "group-hover:scale-[1.015] group-hover:contrast-[1.07] group-hover:saturate-[1.07]",
                "group-hover:[filter:contrast(1.07)_saturate(1.07)_brightness(1.02)_unsharp-mask(0.7px_0.7px_0px)]",
                // Loading optimization with quality-focused background
                "bg-gradient-to-br from-orange-50/60 to-orange-100/60 dark:from-orange-950/15 dark:to-orange-900/15"
              )}
              loading="lazy"
              fetchPriority="low"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              srcSet={`${app.screenshotUrl} 1x, ${app.screenshotUrl} 1.5x, ${app.screenshotUrl} 2x, ${app.screenshotUrl} 3x`}
              decoding="async"
              onError={(e) => {
                // Smooth fallback to placeholder
                const target = e.target as HTMLImageElement;
                target.style.opacity = '0';
                setTimeout(() => {
                  target.style.display = 'none';
                  const placeholder = target.parentElement?.querySelector('.screenshot-placeholder') as HTMLElement;
                  if (placeholder) {
                    placeholder.classList.remove('hidden');
                    placeholder.style.opacity = '1';
                  }
                }, 150);
              }}
              onLoad={(e) => {
                // Ensure smooth appearance with advanced quality enhancement
                const target = e.target as HTMLImageElement;
                target.style.opacity = '1';
                // Apply dynamic quality optimizations after load
                const devicePixelRatio = window.devicePixelRatio || 1;
                if (devicePixelRatio >= 2) {
                  target.style.imageRendering = 'high-quality';
                  target.style.filter = 'contrast(1.05) saturate(1.06) brightness(1.02) unsharp-mask(0.7px 0.7px 0px)';
                } else {
                  target.style.imageRendering = 'auto';
                  target.style.filter = 'contrast(1.04) saturate(1.05) brightness(1.02) unsharp-mask(0.5px 0.5px 0px)';
                }
                target.style.backfaceVisibility = 'hidden';
                target.style.willChange = 'transform';
              }}
              style={{ 
                opacity: 0, 
                transition: 'opacity 0.3s ease-out',
                // Advanced CSS-level quality optimizations
                imageRendering: 'auto',
                backfaceVisibility: 'hidden',
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform',
                contain: 'layout style paint',
                isolation: 'isolate',
                // Enhanced quality filters with cross-browser support
                filter: 'contrast(1.04) saturate(1.05) brightness(1.02)',
                WebkitFontSmoothing: 'subpixel-antialiased',
                textRendering: 'optimizeLegibility',
                fontFeatureSettings: '"kern" 1'
              }}
            />
          ) : null}
          
          {/* Enhanced Fallback Placeholder */}
          <div className={cn(
            "screenshot-placeholder w-full h-full flex flex-col items-center justify-center absolute inset-0 transition-all duration-300",
            app.screenshotUrl ? "hidden opacity-0" : "opacity-100",
            // Enhanced placeholder design
            "bg-gradient-to-br from-orange-50 via-orange-100/80 to-orange-200/60 dark:from-orange-950/30 dark:via-orange-900/20 dark:to-orange-800/10"
          )}>
            <div className="flex flex-col items-center gap-3 text-orange-400/70 dark:text-orange-500/50">
              <div className="relative">
                <Code2 className="h-12 w-12 drop-shadow-sm" />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-200/30 to-transparent rounded blur-sm" />
              </div>
              <div className="text-xs font-medium text-center px-4 opacity-60">
                Preview Unavailable
              </div>
            </div>
          </div>
          
          {/* Enhanced status indicator for deployed apps - only show for deployed apps */}
          {deploymentStatus?.color === 'text-green-500' && hasDeploymentFields(app) && app.deploymentUrl && (
            <button
              className="absolute top-2 left-2 group/status h-4 w-4 hover:h-8 hover:w-8 rounded-full bg-green-400/70 backdrop-blur-sm hover:bg-green-500/90 transition-all duration-300 ease-out flex items-center justify-center shadow-sm hover:shadow-lg border border-green-300/20 hover:border-green-400/40"
              onClick={(e) => {
                e.stopPropagation();
                if (hasDeploymentFields(app) && app.deploymentUrl) {
                  window.open(app.deploymentUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              title="Open deployed app in new tab"
              aria-label="Open deployed app in new tab"
            >
              {/* Subtle dot indicator - visible by default */}
              <div className="w-1 h-1 bg-white/90 rounded-full animate-pulse group-hover/status:opacity-0 transition-opacity duration-200" />
              
              {/* External link icon - visible on hover, larger for clarity */}
              <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover/status:opacity-100 transition-all duration-200 absolute" />
            </button>
          )}
          
          {/* Deploying status indicator - only show when actually deploying */}
          {deploymentStatus?.color === 'text-green-400' && getAppDeploymentStatus(app) === 'deploying' && (
            <div 
              className="absolute top-2 left-2 h-4 w-4 rounded-full bg-green-300/70 backdrop-blur-sm flex items-center justify-center shadow-sm border border-green-200/20"
              title="App is deploying"
              aria-label="App deployment in progress"
            >
              <Loader2 className="w-2 h-2 text-white/90 animate-spin" />
            </div>
          )}
          
          {/* Failed deployment status indicator - only show when deployment actually failed */}
          {deploymentStatus?.color === 'text-gray-500' && getAppDeploymentStatus(app) === 'failed' && (
            <div 
              className="absolute top-2 left-2 h-4 w-4 rounded-full bg-gray-400/70 backdrop-blur-sm flex items-center justify-center shadow-sm border border-gray-300/20"
              title="Deployment failed"
              aria-label="App deployment failed"
            >
              <CloudOff className="w-2 h-2 text-white/90" />
            </div>
          )}
          
          {/* GitHub Repository Badge - moved to app info section, removed from screenshot overlay */}

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
              
              {/* Enhanced Adaptive Metadata with GitHub integration */}
              <div className="transition-all duration-200 ease-out group-hover:translate-x-0.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <AdaptiveMetadata 
                      app={app} 
                      layoutConfig={layoutConfig} 
                      hasOverlayStatus={!!deploymentStatus && deploymentStatus.color !== 'text-gray-500'}
                    />
                  </div>
                  {/* GitHub Repository Button - integrated into app info */}
                  {app.githubRepositoryUrl && (
                    <button
                      className="group/github flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (app.githubRepositoryUrl) {
                          window.open(app.githubRepositoryUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      title={`View on GitHub (${app.githubRepositoryVisibility || 'public'})`}
                      aria-label="View repository on GitHub"
                    >
                      <Github className="w-3 h-3 text-gray-600 dark:text-gray-400 group-hover/github:text-gray-800 dark:group-hover/github:text-gray-200 transition-colors" />
                      {app.githubRepositoryVisibility === 'private' && (
                        <Lock className="w-2.5 h-2.5 text-gray-500 dark:text-gray-500" />
                      )}
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 group-hover/github:text-gray-800 dark:group-hover/github:text-gray-200 transition-colors">
                        {app.githubRepositoryVisibility === 'private' ? 'Private' : 'Repo'}
                      </span>
                    </button>
                  )}
                </div>
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