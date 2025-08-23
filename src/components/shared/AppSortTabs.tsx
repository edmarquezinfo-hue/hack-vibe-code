import React from 'react';
import { Clock, TrendingUp, Star } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppSortOption } from '@/api-types';

interface SortOption {
  value: AppSortOption;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AppSortTabsProps {
  value: AppSortOption;
  onValueChange: (value: string) => void;
  availableSorts?: AppSortOption[];
  className?: string;
}

// Define all possible sort options with their display properties
const SORT_CONFIGURATIONS: Record<AppSortOption, SortOption> = {
  recent: {
    value: 'recent',
    label: 'Recent',
    icon: Clock
  },
  popular: {
    value: 'popular',
    label: 'Popular',
    icon: TrendingUp
  },
  trending: {
    value: 'trending',
    label: 'Trending',
    icon: TrendingUp
  },
  starred: {
    value: 'starred',
    label: 'Bookmarked',
    icon: Star
  }
};

export const AppSortTabs: React.FC<AppSortTabsProps> = ({
  value,
  onValueChange,
  availableSorts = ['recent', 'popular', 'trending'],
  className = ''
}) => {
  const sortOptions = availableSorts.map(sortKey => SORT_CONFIGURATIONS[sortKey]);

  return (
    <Tabs value={value} onValueChange={onValueChange} className={`w-full ${className}`}>
      <TabsList className={`grid w-full grid-cols-${sortOptions.length}`}>
        {sortOptions.map(({ value: sortValue, label, icon: Icon }) => (
          <TabsTrigger 
            key={sortValue} 
            value={sortValue} 
            className="flex items-center gap-2"
          >
            <Icon className="h-4 w-4" />
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};