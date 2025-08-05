import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

interface App {
  id: string;
  title: string;
  description?: string;
  framework?: string;
  updatedAt: string;
  isFavorite?: boolean;
}

interface AppCardProps {
  app: App;
  onClick: (appId: string) => void;
  formatDate: (dateString: string) => string;
}

export const AppCard = React.memo<AppCardProps>(({ app, onClick, formatDate }) => {
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-all"
      onClick={() => onClick(app.id)}
    >
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
            {formatDate(app.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

AppCard.displayName = 'AppCard';