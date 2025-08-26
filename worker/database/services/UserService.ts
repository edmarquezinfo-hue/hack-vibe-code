/**
 * User Service
 * Handles all user-related database operations including sessions, teams, and profiles
 * Extracted from main DatabaseService to maintain single responsibility principle
 */

import { BaseService } from './BaseService';
import * as schema from '../schema';
import { eq, and, sql, lt } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import type {
    UserTeamData,
    EnhancedAppData,
    AppQueryOptions,
    EnhancedUserStats,
    UserActivity
} from '../types';
import { AnalyticsService } from './AnalyticsService';
import { AppService } from './AppService';

/**
 * User Service Class
 * Comprehensive user management operations
 */
export class UserService extends BaseService {

    // ========================================
    // USER MANAGEMENT
    // ========================================

    async createUser(userData: schema.NewUser): Promise<schema.User> {
        const [user] = await this.database
            .insert(schema.users)
            .values({ ...userData, id: generateId() })
            .returning();
        return user;
    }

    async findUserByEmail(email: string): Promise<schema.User | null> {
        const users = await this.database
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);
        return users[0] || null;
    }

    async findUserById(id: string): Promise<schema.User | null> {
        const users = await this.database
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, id))
            .limit(1);
        return users[0] || null;
    }

    async findUserByProvider(provider: string, providerId: string): Promise<schema.User | null> {
        const users = await this.database
            .select()
            .from(schema.users)
            .where(and(
                eq(schema.users.provider, provider),
                eq(schema.users.providerId, providerId)
            ))
            .limit(1);
        return users[0] || null;
    }

    async updateUserActivity(userId: string): Promise<void> {
        await this.database
            .update(schema.users)
            .set({ 
                lastActiveAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(schema.users.id, userId));
    }

    // ========================================
    // SESSION MANAGEMENT
    // ========================================

    async createSession(sessionData: schema.NewSession): Promise<schema.Session> {
        const [session] = await this.database
            .insert(schema.sessions)
            .values({ ...sessionData, id: generateId() })
            .returning();
        return session;
    }

    async findValidSession(sessionId: string): Promise<schema.Session | null> {
        const sessions = await this.database
            .select()
            .from(schema.sessions)
            .where(and(
                eq(schema.sessions.id, sessionId),
                sql`${schema.sessions.expiresAt} > CURRENT_TIMESTAMP`
            ))
            .limit(1);
        return sessions[0] || null;
    }

    async cleanupExpiredSessions(): Promise<void> {
        const now = new Date();
        await this.database
            .delete(schema.sessions)
            .where(lt(schema.sessions.expiresAt, now));
    }

    // ========================================
    // TEAM OPERATIONS
    // ========================================

    async createTeam(teamData: Omit<schema.NewTeam, 'id'>): Promise<schema.Team> {
        const [team] = await this.database
            .insert(schema.teams)
            .values({
                ...teamData,
                id: generateId(),
                slug: this.generateSlug(teamData.name),
            })
            .returning();

        // Add owner as team member
        await this.addTeamMember(team.id, team.ownerId, 'owner');
        return team;
    }

    async addTeamMember(teamId: string, userId: string, role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'): Promise<void> {
        await this.database
            .insert(schema.teamMembers)
            .values({
                id: generateId(),
                teamId,
                userId,
                role: role as 'owner' | 'admin' | 'member' | 'viewer',
                joinedAt: new Date(),
            });
    }

    /**
     * Team fields selector helper
     */
    private get TEAM_SELECT_FIELDS() {
        return {
            id: schema.teams.id,
            name: schema.teams.name,
            slug: schema.teams.slug,
            description: schema.teams.description,
            avatarUrl: schema.teams.avatarUrl,
            visibility: schema.teams.visibility,
            ownerId: schema.teams.ownerId,
            createdAt: schema.teams.createdAt,
            updatedAt: schema.teams.updatedAt,
            deletedAt: schema.teams.deletedAt,
            plan: schema.teams.plan,
            maxMembers: schema.teams.maxMembers,
            maxApps: schema.teams.maxApps,
            allowMemberInvites: schema.teams.allowMemberInvites,
        } as const;
    }

    async getUserTeams(userId: string): Promise<UserTeamData[]> {
        const results = await this.database
            .select({
                ...this.TEAM_SELECT_FIELDS,
                memberRole: schema.teamMembers.role,
            })
            .from(schema.teams)
            .innerJoin(schema.teamMembers, eq(schema.teams.id, schema.teamMembers.teamId))
            .where(and(
                eq(schema.teamMembers.userId, userId),
                eq(schema.teamMembers.status, 'active')
            ));
        
        return results;
    }

    // ========================================
    // USER PROFILE AND DASHBOARD OPERATIONS
    // ========================================

    /**
     * Get comprehensive dashboard data for user controller
     * Combines user profile, apps, teams, analytics in optimized queries
     */
    async getUserDashboardData(userId: string): Promise<{
        user: schema.User | null;
        stats: { totalApps: number; appsThisMonth: number; totalTeams: number; cloudflareAccounts: number };
        recentApps: EnhancedAppData[];
        teams: UserTeamData[];
        cloudflareAccounts: schema.CloudflareAccount[];
    }> {
        // Get user profile
        const user = await this.database
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .get();

        if (!user) {
            throw new Error('User not found');
        }

        // Get data in parallel for better performance
        const [stats, recentApps, teams, cloudflareAccounts] = await Promise.all([
            this.getUserStatisticsBasic(userId),
            this.getRecentAppsWithAnalytics(userId, 10),
            this.getUserTeams(userId),
            this.getCloudflareAccounts(userId)
        ]);

        return {
            user,
            stats: {
                ...stats,
                totalTeams: teams.length,
                cloudflareAccounts: cloudflareAccounts.length
            },
            recentApps,
            teams,
            cloudflareAccounts
        };
    }

    /**
     * Get user apps with analytics data integrated
     * Consolidates app retrieval with analytics for consistent patterns
     */
    async getUserAppsWithAnalytics(userId: string, options: Partial<AppQueryOptions> = {}): Promise<EnhancedAppData[]> {
        // Use AppService for consistent app operations
        const appService = new AppService(this.db);
        return appService.getUserAppsWithAnalytics(userId, options);
    }

    /**
     * Get total count of user apps with filters (for pagination)
     */
    async getUserAppsCount(userId: string, options: Partial<AppQueryOptions> = {}): Promise<number> {
        // Use AppService for consistent app operations
        const appService = new AppService(this.db);
        return appService.getUserAppsCount(userId, options);
    }

    /**
     * Get recent apps with analytics for dashboard
     * Specialized method for dashboard's recent apps section
     */
    private async getRecentAppsWithAnalytics(userId: string, limit: number): Promise<EnhancedAppData[]> {
        return this.getUserAppsWithAnalytics(userId, { limit, offset: 0 });
    }

    /**
     * Update user profile with comprehensive validation
     * Centralizes all validation logic and database updates
     */
    async updateUserProfileWithValidation(
        userId: string,
        profileData: {
            username?: string;
            displayName?: string;
            bio?: string;
            theme?: 'light' | 'dark' | 'system';
        }
    ): Promise<{ success: boolean; message: string }> {
        // Validate username if provided
        if (profileData.username) {
            const { username } = profileData;

            // Format validation
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                return { 
                    success: false, 
                    message: 'Username can only contain letters, numbers, underscores, and hyphens' 
                };
            }
            
            if (username.length < 3 || username.length > 30) {
                return { 
                    success: false, 
                    message: 'Username must be between 3 and 30 characters' 
                };
            }
            
            // Check reserved usernames
            const reserved = ['admin', 'api', 'www', 'mail', 'ftp', 'root', 'support', 'help', 'about', 'terms', 'privacy'];
            if (reserved.includes(username.toLowerCase())) {
                return { 
                    success: false, 
                    message: 'Username is reserved' 
                };
            }
            
            // Check uniqueness
            const existingUser = await this.database
                .select({ id: schema.users.id })
                .from(schema.users)
                .where(eq(schema.users.username, username))
                .get();

            if (existingUser && existingUser.id !== userId) {
                return { 
                    success: false, 
                    message: 'Username already taken' 
                };
            }
        }

        // Update profile
        await this.database
            .update(schema.users)
            .set({
                username: profileData.username || undefined,
                displayName: profileData.displayName || undefined,
                bio: profileData.bio || undefined,
                theme: profileData.theme || undefined,
                updatedAt: new Date()
            })
            .where(eq(schema.users.id, userId));

        return { success: true, message: 'Profile updated successfully' };
    }

    /**
     * Get basic user statistics efficiently
     * Consolidates helper methods from controller into single service call
     */
    async getUserStatisticsBasic(userId: string): Promise<{ totalApps: number; appsThisMonth: number }> {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const [totalApps, appsThisMonth] = await Promise.all([
            // Total apps count
            this.database
                .select({ count: sql<number>`COUNT(*)` })
                .from(schema.apps)
                .where(eq(schema.apps.userId, userId))
                .get()
                .then(r => Number(r?.count) || 0),

            // Apps created this month
            this.database
                .select({ count: sql<number>`COUNT(*)` })
                .from(schema.apps)
                .where(and(
                    eq(schema.apps.userId, userId),
                    sql`${schema.apps.createdAt} >= ${startOfMonth}`
                ))
                .get()
                .then(r => Number(r?.count) || 0)
        ]);

        return { totalApps, appsThisMonth };
    }

    /**
     * Get comprehensive user statistics for stats controller
     * Leverages AnalyticsService for consistent statistics across app
     */
    async getUserStatisticsEnhanced(userId: string): Promise<EnhancedUserStats> {
        const analyticsService = new AnalyticsService(this.db);
        return analyticsService.getEnhancedUserStats(userId);
    }

    /**
     * Get user activity timeline for stats controller
     * Leverages AnalyticsService for consistent data access patterns
     */
    async getUserActivityTimeline(userId: string, limit?: number): Promise<UserActivity[]> {
        const analyticsService = new AnalyticsService(this.db);
        return analyticsService.getUserActivityTimeline(userId, limit);
    }

    // ========================================
    // CLOUDFLARE ACCOUNT OPERATIONS (User-related)
    // ========================================

    async getCloudflareAccounts(userId?: string, teamId?: string): Promise<schema.CloudflareAccount[]> {
        const whereConditions = [
            eq(schema.cloudflareAccounts.isActive, true),
            userId && teamId ? and(
                eq(schema.cloudflareAccounts.userId, userId),
                eq(schema.cloudflareAccounts.teamId, teamId)
            ) : undefined,
            userId && !teamId ? eq(schema.cloudflareAccounts.userId, userId) : undefined,
            teamId && !userId ? eq(schema.cloudflareAccounts.teamId, teamId) : undefined,
        ];

        const whereClause = this.buildWhereConditions(whereConditions);

        return await this.database
            .select()
            .from(schema.cloudflareAccounts)
            .where(whereClause);
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    private generateSlug(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
            .substring(0, 50);
    }
}