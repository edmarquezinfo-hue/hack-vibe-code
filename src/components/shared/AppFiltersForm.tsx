import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimePeriodSelector } from './TimePeriodSelector';
import type { TimePeriod, AppSortOption } from '@/api-types';

interface AppFiltersFormProps {
  // Search props
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  searchPlaceholder?: string;
  showSearchButton?: boolean;

  // Framework filter props
  filterFramework: string;
  onFrameworkChange: (framework: string) => void;

  // Visibility filter props (optional - only for user apps)
  filterVisibility?: string;
  onVisibilityChange?: (visibility: string) => void;
  showVisibility?: boolean;

  // Time period props (conditional)
  period?: TimePeriod;
  onPeriodChange?: (period: TimePeriod) => void;
  sortBy?: AppSortOption;

  // Layout props
  className?: string;
}

const FRAMEWORK_OPTIONS = [
  { value: 'all', label: 'All Frameworks' },
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'angular', label: 'Angular' },
  { value: 'vanilla', label: 'Vanilla JS' },
];

const VISIBILITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'private', label: 'Private' },
  { value: 'team', label: 'Team' },
  { value: 'board', label: 'Board' },
  { value: 'public', label: 'Public' },
];

export const AppFiltersForm: React.FC<AppFiltersFormProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search apps...',
  showSearchButton = false,
  filterFramework,
  onFrameworkChange,
  filterVisibility = 'all',
  onVisibilityChange,
  showVisibility = false,
  period,
  onPeriodChange,
  sortBy,
  className = ''
}) => {
  const shouldShowTimePeriod = period && onPeriodChange && sortBy && (sortBy === 'popular' || sortBy === 'trending');

  return (
    <div className={`max-w-4xl mx-auto mb-8 ${className}`}>
      <form onSubmit={onSearchSubmit} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterFramework} onValueChange={onFrameworkChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Framework" />
          </SelectTrigger>
          <SelectContent>
            {FRAMEWORK_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showVisibility && onVisibilityChange && (
          <Select value={filterVisibility} onValueChange={onVisibilityChange}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              {VISIBILITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {shouldShowTimePeriod && (
          <TimePeriodSelector
            value={period}
            onValueChange={onPeriodChange}
            className="w-[120px]"
            showForSort={sortBy}
          />
        )}

        {showSearchButton && (
          <Button type="submit">
            Search
          </Button>
        )}
      </form>
    </div>
  );
};