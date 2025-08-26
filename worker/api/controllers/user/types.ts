/**
 * Type definitions for User Controller responses
 */

import { EnhancedAppData, UserTeamData, PaginationInfo } from '../../../database/types';
import * as schema from '../../../database/schema';

/**
 * Response data for getDashboard
 * Uses existing types directly - no duplication
 */
export interface DashboardData {
    user: schema.User;
    stats: { totalApps: number; appsThisMonth: number; totalTeams: number; cloudflareAccounts: number };
    recentApps: EnhancedAppData[];
    teams: UserTeamData[];
    cloudflareAccounts: schema.CloudflareAccount[];
}

/**
 * Response data for getApps
 * Uses existing types directly - no duplication
 */
export interface UserAppsData {
    apps: EnhancedAppData[];
    pagination: PaginationInfo;
}

/**
 * Response data for updateProfile
 * Simple result interface - no duplication needed
 */
export interface ProfileUpdateData {
    success: boolean;
    message: string;
}

/**
 * Response data for getTeams
 * Uses existing types directly - no duplication
 */
export interface UserTeamsData {
    teams: UserTeamData[];
}