import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import type { AppWithFavoriteStatus } from '@/api-types';

interface AppCardProps {
  app: AppWithFavoriteStatus;
  onClick: (appId: string) => void;
  formatDate: (dateString: string) => string;
}

export const AppCard = React.memo<AppCardProps>(({ app, onClick, formatDate }) => {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all overflow-hidden group"
      onClick={() => onClick(app.id)}
    >
      {/* Screenshot Preview */}
      {app.screenshotUrl && (
        <div className="relative h-32 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          <img 
            src={app.screenshotUrl} 
            alt={`${app.title} preview`}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              // Hide image on error and show placeholder instead
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
      )}
      
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">{app.title}</CardTitle>
            <CardDescription className="text-xs">
              {app.description || 'No description'}
            </CardDescription>
          </div>
          {app.isFavorite && (
            <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {app.framework}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(app.updatedAt ? app.updatedAt.toString() : '')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

AppCard.displayName = 'AppCard';