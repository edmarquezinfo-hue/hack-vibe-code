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
  Bookmark
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { AppWithFavoriteStatus, AppWithUserAndStats, EnhancedAppData } from '@/api-types';

// Union type for both app types - make updatedAtFormatted optional
type AppCardData = AppWithFavoriteStatus | (EnhancedAppData & { updatedAtFormatted?: string }) | AppWithUserAndStats;

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

export const AppCard = React.memo<AppCardProps>(({ 
  app, 
  onClick, 
  onToggleFavorite,
  showStats = true,
  showUser = false,
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
    }
  };

  return (
    <motion.div variants={itemVariants} className={className}>
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
          
          {/* Framework Badge */}
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 bg-background/90 dark:bg-card/90 backdrop-blur-sm"
          >
            {app.framework || 'React'}
          </Badge>

          {/* Visibility Badge for User Apps */}
          {isUserApp(app) && (
            <div className="absolute top-2 left-2 bg-background/90 dark:bg-card/90 backdrop-blur-sm rounded-md p-1">
              {getVisibilityIcon(app.visibility)}
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
          
          {app.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {app.description}
            </p>
          )}
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
          {showStats && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {isPublicApp(app) && (
                <>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    <span>{app.viewCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className={cn("h-3.5 w-3.5", app.userStarred && "fill-yellow-500 text-yellow-500")} />
                    <span>{app.starCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>{app.forkCount || 0}</span>
                  </div>
                </>
              )}
              {isUserApp(app) && (app as any).viewCount !== undefined && (
                <>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    <span>{(app as any).viewCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5" />
                    <span>{(app as any).starCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>{(app as any).forkCount || 0}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

AppCard.displayName = 'AppCard';