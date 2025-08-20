/**
 * App Service
 * Handles all app-related database operations including favorites, views, stars, and forking
 * Extracted from main DatabaseService to maintain single responsibility principle
 */

import { BaseService } from './BaseService';
import * as schema from '../schema';
import { eq, and, or, desc, asc, sql, SQL, isNull, inArray } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import { formatRelativeTime } from '../../utils/timeFormatter';
import type {
    EnhancedAppData,
    AppWithFavoriteStatus,
    FavoriteToggleResult,
    PaginatedResult,
    PaginationOptions,
    AppQueryOptions,
    PublicAppQueryOptions,
    OwnershipResult,
    AppVisibilityUpdateResult,
    SimpleAppCreation,
    TimePeriod,
    AppSortOption,
    SortOrder
} from '../types';
import { AnalyticsService } from './AnalyticsService';

/**
 * Type-safe where conditions for queries
 */
type WhereCondition = SQL<unknown> | undefined;

/**
 * App with only favorite apps (always true) - Service specific
 */
interface FavoriteAppResult extends schema.App {
    isFavorite: true;
    updatedAtFormatted: string;
}

/**
 * App update metadata for internal tracking - Service specific
 */
interface AppUpdateMetadata {
    deploymentUrl?: string;
    screenshotUrl?: string;
    [key: string]: unknown;
}

/**
 * App Service Class
 * Comprehensive app management operations
 */
export class AppService extends BaseService {

    // ========================================
    // FIELD SELECTORS AND QUERY HELPERS
    // ========================================

    /**
     * Complete app selection fields helper - eliminates 20+ line duplication
     */
    private readonly APP_SELECT_FIELDS = {
        id: schema.apps.id,
        title: schema.apps.title,
        description: schema.apps.description,
        slug: schema.apps.slug,
        iconUrl: schema.apps.iconUrl,
        originalPrompt: schema.apps.originalPrompt,
        finalPrompt: schema.apps.finalPrompt,
        blueprint: schema.apps.blueprint,
        framework: schema.apps.framework,
        userId: schema.apps.userId,
        teamId: schema.apps.teamId,
        sessionToken: schema.apps.sessionToken,
        visibility: schema.apps.visibility,
        boardId: schema.apps.boardId,
        status: schema.apps.status,
        deploymentUrl: schema.apps.deploymentUrl,
        cloudflareAccountId: schema.apps.cloudflareAccountId,
        deploymentStatus: schema.apps.deploymentStatus,
        deploymentMetadata: schema.apps.deploymentMetadata,
        isArchived: schema.apps.isArchived,
        isFeatured: schema.apps.isFeatured,
        version: schema.apps.version,
        parentAppId: schema.apps.parentAppId,
        screenshotUrl: schema.apps.screenshotUrl,
        screenshotCapturedAt: schema.apps.screenshotCapturedAt,
        createdAt: schema.apps.createdAt,
        updatedAt: schema.apps.updatedAt,
        lastDeployedAt: schema.apps.lastDeployedAt,
    } as const;

    /**
     * Helper function to create favorite status query
     */
    private createFavoriteStatusQuery(userId: string) {
        return sql<boolean>`
            EXISTS (
                SELECT 1 FROM ${schema.favorites} 
                WHERE ${schema.favorites.userId} = ${userId} 
                AND ${schema.favorites.appId} = ${schema.apps.id}
            )
        `.as('isFavorite');
    }


    // ========================================
    // APP OPERATIONS
    // ========================================

    /**
     * Create a new app with full schema data
     */
    async createApp(appData: Omit<schema.NewApp, 'id'>): Promise<schema.App> {
        const [app] = await this.database
            .insert(schema.apps)
            .values({
                ...appData,
                id: generateId(),
                slug: appData.title ? this.generateSlug(appData.title) : undefined,
            })
            .returning();
        return app;
    }

    /**
     * Create a new app with simplified interface for common use cases
     */
    async createSimpleApp(appData: SimpleAppCreation): Promise<schema.App> {
        const fullAppData: Omit<schema.NewApp, 'id'> = {
            userId: appData.userId,
            title: appData.title,
            description: appData.description || null,
            framework: appData.framework || 'react',
            visibility: appData.visibility || 'private',
            iconUrl: null,
            originalPrompt: appData.title, // Use title as original prompt
            createdAt: new Date(),
            updatedAt: new Date()
        };

        return this.createApp(fullAppData);
    }

    async getUserApps(
        userId: string,
        options: AppQueryOptions = {}
    ): Promise<schema.App[]> {
        const { teamId, status, visibility, limit = 50, offset = 0 } = options;

        const whereConditions: WhereCondition[] = [
            eq(schema.apps.userId, userId),
            teamId ? eq(schema.apps.teamId, teamId) : undefined,
            status ? eq(schema.apps.status, status) : undefined,
            visibility ? eq(schema.apps.visibility, visibility) : undefined,
        ];

        const whereClause = this.buildWhereConditions(whereConditions);

        return await this.database
            .select()
            .from(schema.apps)
            .where(whereClause)
            .orderBy(desc(schema.apps.updatedAt))
            .limit(limit)
            .offset(offset);
    }

    /**
     * Get public apps - simple version returning just app data
     */
    async getPublicApps(options: PublicAppQueryOptions = {}): Promise<schema.App[]> {
        const { 
            boardId, 
            limit = 20, 
            offset = 0, 
            framework, 
            search 
        } = options;

        const whereConditions = this.buildPublicAppConditions(boardId, framework, search);
        const whereClause = this.buildWhereConditions(whereConditions);

        return await this.database
            .select()
            .from(schema.apps)
            .where(whereClause)
            .orderBy(desc(schema.apps.createdAt))
            .limit(limit)
            .offset(offset);
    }

    /**
     * Get enhanced public apps with user stats and pagination
     * Uses unified analytics approach for consistency with server-side sorting
     */
    async getPublicAppsEnhanced(options: PublicAppQueryOptions = {}): Promise<PaginatedResult<EnhancedAppData>> {
        const { 
            boardId, 
            limit = 20, 
            offset = 0, 
            framework, 
            search, 
            sort = 'recent',
            order = 'desc',
            period = 'all',
            userId 
        } = options;

        const whereConditions = this.buildPublicAppConditions(boardId, framework, search);
        const whereClause = this.buildWhereConditions(whereConditions);
        
        // Create sort clauses using server-side sorting
        const sortClauses = this.createSortClause(sort, order, period);

        // Get basic apps with user data and server-side sorting
        const basicApps = await this.database
            .select({
                ...this.APP_SELECT_FIELDS,
                userName: schema.users.displayName,
                userAvatar: schema.users.avatarUrl,
            })
            .from(schema.apps)
            .leftJoin(schema.users, eq(schema.apps.userId, schema.users.id))
            .where(whereClause)
            .orderBy(...sortClauses)
            .limit(limit)
            .offset(offset);

        // Get total count for pagination
        const totalCountResult = await this.database
            .select({ count: sql<number>`COUNT(*)` })
            .from(schema.apps)
            .where(whereClause);

        const total = totalCountResult[0]?.count || 0;

        if (basicApps.length === 0) {
            return {
                data: [],
                pagination: {
                    limit,
                    offset,
                    total,
                    hasMore: false
                }
            };
        }

        // Use unified analytics enhancement approach
        const enhancedApps = await this.enhanceAppsWithAnalytics(basicApps, userId, true);

        return {
            data: enhancedApps,
            pagination: {
                limit,
                offset,
                total,
                hasMore: offset + limit < total
            }
        };
    }

    /**
     * Helper to build public app query conditions
     */
    private buildPublicAppConditions(
        boardId?: string, 
        framework?: string, 
        search?: string
    ): WhereCondition[] {
        const whereConditions: WhereCondition[] = [
            // Only show public apps or apps from anonymous users
            or(
                eq(schema.apps.visibility, 'public'),
                isNull(schema.apps.userId)
            ),
            or(
                eq(schema.apps.status, 'completed'),
                eq(schema.apps.status, 'generating')
            ),
            boardId ? eq(schema.apps.boardId, boardId) : undefined,
            framework ? eq(schema.apps.framework, framework) : undefined,
        ];

        if (search) {
            const searchTerm = `%${search.toLowerCase()}%`;
            whereConditions.push(
                or(
                    sql`LOWER(${schema.apps.title}) LIKE ${searchTerm}`,
                    sql`LOWER(${schema.apps.description}) LIKE ${searchTerm}`
                )
            );
        }

        return whereConditions;
    }

    async updateAppStatus(
        appId: string, 
        status: 'generating' | 'completed', 
        metadata?: AppUpdateMetadata
    ): Promise<void> {
        const updateData: Partial<typeof schema.apps.$inferInsert> = { 
            status, 
            updatedAt: new Date() 
        };

        if (status === 'completed' && metadata?.deploymentUrl) {
            updateData.deploymentUrl = metadata.deploymentUrl;
            updateData.lastDeployedAt = new Date();
        }

        await this.database
            .update(schema.apps)
            .set(updateData)
            .where(eq(schema.apps.id, appId));
    }

    /**
     * Get user apps with favorite status
     */
    async getUserAppsWithFavorites(
        userId: string, 
        options: PaginationOptions = {}
    ): Promise<AppWithFavoriteStatus[]> {
        const { limit = 50, offset = 0 } = options;
        
        const results = await this.database
            .select({
                ...this.APP_SELECT_FIELDS,
                isFavorite: this.createFavoriteStatusQuery(userId)
            })
            .from(schema.apps)
            .where(eq(schema.apps.userId, userId))
            .orderBy(desc(schema.apps.updatedAt))
            .limit(limit)
            .offset(offset);

        return results.map(app => ({
            ...app,
            updatedAtFormatted: formatRelativeTime(app.updatedAt)
        }));
    }

    /**
     * Get recent user apps with favorite status
     */
    async getRecentAppsWithFavorites(
        userId: string, 
        limit: number = 10
    ): Promise<AppWithFavoriteStatus[]> {
        return this.getUserAppsWithFavorites(userId, { limit, offset: 0 });
    }

    /**
     * Get only favorited apps for a user
     */
    async getFavoriteAppsOnly(
        userId: string
    ): Promise<FavoriteAppResult[]> {
        const results = await this.database
            .select(this.APP_SELECT_FIELDS)
            .from(schema.apps)
            .innerJoin(schema.favorites, and(
                eq(schema.favorites.appId, schema.apps.id),
                eq(schema.favorites.userId, userId)
            ))
            .orderBy(desc(schema.apps.updatedAt));

        return results.map(app => ({
            ...app,
            isFavorite: true as const,
            updatedAtFormatted: formatRelativeTime(app.updatedAt)
        }));
    }


    /**
     * Toggle favorite status for an app
     */
    async toggleAppFavorite(userId: string, appId: string): Promise<FavoriteToggleResult> {
        // Check if already favorited
        const existingFavorite = await this.database
            .select()
            .from(schema.favorites)
            .where(and(
                eq(schema.favorites.appId, appId),
                eq(schema.favorites.userId, userId)
            ))
            .limit(1);

        if (existingFavorite.length > 0) {
            // Remove favorite
            await this.database
                .delete(schema.favorites)
                .where(and(
                    eq(schema.favorites.appId, appId),
                    eq(schema.favorites.userId, userId)
                ));
            return { isFavorite: false };
        } else {
            // Add favorite
            await this.database
                .insert(schema.favorites)
                .values({
                    id: generateId(),
                    userId,
                    appId,
                    createdAt: new Date()
                });
            return { isFavorite: true };
        }
    }

    /**
     * Check if user owns an app
     */
    async checkAppOwnership(appId: string, userId: string): Promise<OwnershipResult> {
        const app = await this.database
            .select({
                id: schema.apps.id,
                userId: schema.apps.userId
            })
            .from(schema.apps)
            .where(eq(schema.apps.id, appId))
            .limit(1);

        if (app.length === 0) {
            return { exists: false, isOwner: false };
        }

        return {
            exists: true,
            isOwner: app[0].userId === userId
        };
    }

    /**
     * Get single app with favorite status for user
     */
    async getSingleAppWithFavoriteStatus(
        appId: string, 
        userId: string
    ): Promise<AppWithFavoriteStatus | null> {
        const apps = await this.database
            .select({
                ...this.APP_SELECT_FIELDS,
                isFavorite: this.createFavoriteStatusQuery(userId)
            })
            .from(schema.apps)
            .where(and(
                eq(schema.apps.id, appId),
                eq(schema.apps.userId, userId)
            ))
            .limit(1);

        if (apps.length === 0) {
            return null;
        }

        return {
            ...apps[0],
            updatedAtFormatted: formatRelativeTime(apps[0].updatedAt)
        };
    }

    /**
     * Update app visibility with ownership check
     */
    async updateAppVisibility(
        appId: string,
        userId: string,
        visibility: 'private' | 'public'
    ): Promise<AppVisibilityUpdateResult> {
        // Check if app exists and user owns it
        const existingApp = await this.database
            .select({
                id: schema.apps.id,
                title: schema.apps.title,
                userId: schema.apps.userId,
                visibility: schema.apps.visibility
            })
            .from(schema.apps)
            .where(eq(schema.apps.id, appId))
            .limit(1);

        if (existingApp.length === 0) {
            return { success: false, error: 'App not found' };
        }

        if (existingApp[0].userId !== userId) {
            return { success: false, error: 'You can only change visibility of your own apps' };
        }

        // Update the app visibility
        const updatedApps = await this.database
            .update(schema.apps)
            .set({
                visibility,
                updatedAt: new Date()
            })
            .where(eq(schema.apps.id, appId))
            .returning({
                id: schema.apps.id,
                title: schema.apps.title,
                visibility: schema.apps.visibility,
                updatedAt: schema.apps.updatedAt
            });

        if (updatedApps.length === 0) {
            return { success: false, error: 'Failed to update app visibility' };
        }

        return { success: true, app: updatedApps[0] };
    }

    // ========================================
    // APP VIEW CONTROLLER OPERATIONS
    // ========================================

    /**
     * Get enhanced app details with user info and stats for app view controller
     * Combines app data, user info, and analytics in single optimized query
     */
    async getAppDetailsEnhanced(appId: string, userId?: string): Promise<EnhancedAppData | null> {
        // Get app with user info using full app selection
        const appResult = await this.database
            .select({
                ...this.APP_SELECT_FIELDS,
                userName: schema.users.displayName,
                userAvatar: schema.users.avatarUrl,
            })
            .from(schema.apps)
            .leftJoin(schema.users, eq(schema.apps.userId, schema.users.id))
            .where(eq(schema.apps.id, appId))
            .get();

        if (!appResult) {
            return null;
        }

        // Get stats in parallel using same pattern as analytics service
        const [viewCount, starCount, isFavorite, userHasStarred] = await Promise.all([
            // View count
            this.database
                .select({ count: sql<number>`count(*)` })
                .from(schema.appViews)
                .where(eq(schema.appViews.appId, appId))
                .get()
                .then(r => r?.count || 0),
            
            // Star count
            this.database
                .select({ count: sql<number>`count(*)` })
                .from(schema.stars)
                .where(eq(schema.stars.appId, appId))
                .get()
                .then(r => r?.count || 0),
            
            // Is favorited by current user
            userId ? this.database
                .select({ id: schema.favorites.id })
                .from(schema.favorites)
                .where(and(
                    eq(schema.favorites.userId, userId),
                    eq(schema.favorites.appId, appId)
                ))
                .get()
                .then(r => !!r) : false,
            
            // Is starred by current user  
            userId ? this.database
                .select({ id: schema.stars.id })
                .from(schema.stars)
                .where(and(
                    eq(schema.stars.userId, userId),
                    eq(schema.stars.appId, appId)
                ))
                .get()
                .then(r => !!r) : false
        ]);

        return {
            ...appResult,
            userName: appResult.userName,
            userAvatar: appResult.userAvatar,
            starCount,
            userStarred: userHasStarred,
            userFavorited: isFavorite,
            viewCount
        };
    }

    /**
     * Toggle star status for an app (star/unstar)
     * Uses same efficient pattern as toggleAppFavorite
     */
    async toggleAppStar(userId: string, appId: string): Promise<{ isStarred: boolean; starCount: number }> {
        // Check if already starred
        const existingStar = await this.database
            .select({ id: schema.stars.id })
            .from(schema.stars)
            .where(and(
                eq(schema.stars.userId, userId),
                eq(schema.stars.appId, appId)
            ))
            .get();

        if (existingStar) {
            // Unstar
            await this.database
                .delete(schema.stars)
                .where(eq(schema.stars.id, existingStar.id))
                .run();
        } else {
            // Star
            await this.database
                .insert(schema.stars)
                .values({
                    id: generateId(),
                    userId,
                    appId,
                    starredAt: new Date()
                })
                .run();
        }

        // Get updated star count
        const starCountResult = await this.database
            .select({ count: sql<number>`count(*)` })
            .from(schema.stars)
            .where(eq(schema.stars.appId, appId))
            .get();

        return {
            isStarred: !existingStar,
            starCount: starCountResult?.count || 0
        };
    }

    /**
     * Record app view with duplicate prevention
     * Abstracts view tracking logic from controller
     */
    async recordAppView(appId: string, userId: string): Promise<void> {
        try {
            await this.database
                .insert(schema.appViews)
                .values({
                    id: generateId(),
                    appId,
                    userId,
                    viewedAt: new Date()
                })
                .run();
        } catch {
            // Ignore duplicate view errors (same pattern as original controller)
        }
    }

    /**
     * Get app for forking with permission checks
     * Single query with built-in ownership/visibility validation
     */
    async getAppForFork(appId: string, userId: string): Promise<{ app: schema.App | null; canFork: boolean }> {
        const app = await this.database
            .select()
            .from(schema.apps)
            .where(eq(schema.apps.id, appId))
            .get();

        if (!app) {
            return { app: null, canFork: false };
        }

        // Check visibility permissions (same logic as original controller)
        const canFork = app.visibility === 'public' || app.userId === userId;

        return { app, canFork };
    }

    /**
     * Create forked app using same patterns as createSimpleApp
     * Clean fork creation with proper schema integration
     */
    async createForkedApp(originalApp: schema.App, newAgentId: string, userId: string): Promise<schema.App> {
        const now = new Date();
        
        const [forkedApp] = await this.database
            .insert(schema.apps)
            .values({
                id: newAgentId,
                userId: userId,
                title: `${originalApp.title} (Fork)`,
                description: originalApp.description,
                originalPrompt: originalApp.originalPrompt,
                finalPrompt: originalApp.finalPrompt,
                framework: originalApp.framework,
                visibility: 'private', // Forks start as private
                status: 'completed', // Forked apps start as completed
                parentAppId: originalApp.id,
                blueprint: originalApp.blueprint,
                createdAt: now,
                updatedAt: now
            })
            .returning();

        return forkedApp;
    }

    /**
     * Get user apps with analytics data integrated
     * Uses unified analytics approach for consistency
     */
    async getUserAppsWithAnalytics(userId: string, options: Partial<AppQueryOptions> = {}): Promise<EnhancedAppData[]> {
        const { 
            limit = 50, 
            offset = 0, 
            status, 
            visibility, 
            teamId, 
            boardId, 
            sort = 'recent', 
            order = 'desc', 
            period = 'all' 
        } = options;

        // Build where conditions like in getUserApps but with enhanced data
        const whereConditions: WhereCondition[] = [
            eq(schema.apps.userId, userId),
            teamId ? eq(schema.apps.teamId, teamId) : undefined,
            status ? eq(schema.apps.status, status) : undefined,
            visibility ? eq(schema.apps.visibility, visibility) : undefined,
            boardId ? eq(schema.apps.boardId, boardId) : undefined,
        ];

        const whereClause = this.buildWhereConditions(whereConditions);
        
        // Create sort clauses using server-side sorting
        const sortClauses = this.createSortClause(sort, order, period);

        // For "starred" sort, we need to join with favorites table and filter
        let basicApps;

        if (sort === 'starred') {
            // Join with favorites and add favorite user filter
            basicApps = await this.database
                .select({
                    ...this.APP_SELECT_FIELDS,
                })
                .from(schema.apps)
                .innerJoin(schema.favorites, eq(schema.favorites.appId, schema.apps.id))
                .where(and(whereClause, eq(schema.favorites.userId, userId)))
                .orderBy(...sortClauses)
                .limit(limit)
                .offset(offset);
        } else {
            basicApps = await this.database
                .select({
                    ...this.APP_SELECT_FIELDS,
                })
                .from(schema.apps)
                .where(whereClause)
                .orderBy(...sortClauses)
                .limit(limit)
                .offset(offset);
        }

        if (basicApps.length === 0) {
            return [];
        }

        // Use unified analytics enhancement approach
        return await this.enhanceAppsWithAnalytics(basicApps, userId, false);
    }

    /**
     * Get total count of user apps with filters (for pagination)
     */
    async getUserAppsCount(userId: string, options: Partial<AppQueryOptions> = {}): Promise<number> {
        const { status, visibility, teamId, boardId, sort = 'recent' } = options;

        const whereConditions: WhereCondition[] = [
            eq(schema.apps.userId, userId),
            teamId ? eq(schema.apps.teamId, teamId) : undefined,
            status ? eq(schema.apps.status, status) : undefined,
            visibility ? eq(schema.apps.visibility, visibility) : undefined,
            boardId ? eq(schema.apps.boardId, boardId) : undefined,
        ];

        const whereClause = this.buildWhereConditions(whereConditions);

        // For "starred" sort, we need to join with favorites table
        const countQuery = this.database
            .select({ count: sql<number>`COUNT(*)` })
            .from(schema.apps);

        if (sort === 'starred') {
            const countResult = await countQuery
                .innerJoin(schema.favorites, eq(schema.favorites.appId, schema.apps.id))
                .where(and(whereClause, eq(schema.favorites.userId, userId)));
            return countResult[0]?.count || 0;
        } else {
            const countResult = await countQuery.where(whereClause);
            return countResult[0]?.count || 0;
        }
    }

    // ========================================
    // UNIFIED ANALYTICS HELPER
    // ========================================

    /**
     * Unified analytics enhancement for app collections
     * OPTIMIZED: Uses batch queries to eliminate N+1 problems and minimize database round trips
     * All analytics data fetched in 6 total queries regardless of app count
     */
    private async enhanceAppsWithAnalytics(
        basicApps: (typeof schema.apps.$inferSelect & { userName?: string | null; userAvatar?: string | null })[], 
        userId?: string,
        includeUserInfo: boolean = false
    ): Promise<EnhancedAppData[]> {
        if (basicApps.length === 0) return [];

        const appIds = basicApps.map(app => app.id);
        
        // BATCH FETCH ALL ANALYTICS DATA IN PARALLEL (6 queries total, not N*3 queries)
        const [
            analyticsData,
            starCounts,
            userStars,
            userFavorites
        ] = await Promise.all([
            // 1. Batch analytics (views, forks, likes) - 3 queries in parallel
            new AnalyticsService(this.db).batchGetAppStats(appIds),
            
            // 2. Batch star counts for all apps - 1 query
            this.database
                .select({
                    appId: schema.stars.appId,
                    count: sql<number>`COUNT(*)`.as('count')
                })
                .from(schema.stars)
                .where(inArray(schema.stars.appId, appIds))
                .groupBy(schema.stars.appId)
                .all(),
            
            // 3. Batch user stars - 1 query (only if userId provided)
            userId ? this.database
                .select({
                    appId: schema.stars.appId
                })
                .from(schema.stars)
                .where(and(
                    eq(schema.stars.userId, userId),
                    inArray(schema.stars.appId, appIds)
                ))
                .all() : [],
            
            // 4. Batch user favorites - 1 query (only if userId provided)
            userId ? this.database
                .select({
                    appId: schema.favorites.appId
                })
                .from(schema.favorites)
                .where(and(
                    eq(schema.favorites.userId, userId),
                    inArray(schema.favorites.appId, appIds)
                ))
                .all() : []
        ]);

        // Create lookup maps for O(1) access
        const starCountMap = new Map(starCounts.map(s => [s.appId, s.count]));
        const userStarMap = new Set(userStars.map(s => s.appId));
        const userFavoriteMap = new Set(userFavorites.map(f => f.appId));

        // Transform apps with O(1) lookups instead of additional queries
        return basicApps.map(app => ({
            ...app,
            userName: includeUserInfo ? (app.userName || null) : null,
            userAvatar: includeUserInfo ? (app.userAvatar || null) : null,
            starCount: starCountMap.get(app.id) || 0,
            userStarred: userStarMap.has(app.id),
            userFavorited: userFavoriteMap.has(app.id),
            viewCount: analyticsData[app.id]?.viewCount || 0,
            forkCount: analyticsData[app.id]?.forkCount || 0,
            likeCount: analyticsData[app.id]?.likeCount || 0
        }));
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Get date threshold for time period filtering
     */
    private getTimePeriodThreshold(period: TimePeriod): Date {
        const now = new Date();
        switch (period) {
            case 'today':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate());
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                return weekAgo;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                return monthAgo;
            case 'all':
            default:
                return new Date(0); // Beginning of time
        }
    }

    /**
     * Create ORDER BY clause based on sort option, order, and time period
     */
    private createSortClause(sort: AppSortOption = 'recent', order: SortOrder = 'desc', period: TimePeriod = 'all') {
        const direction = order === 'asc' ? asc : desc;
        const periodThreshold = this.getTimePeriodThreshold(period);

        switch (sort) {
            case 'popular': {
                // Sort by popularity score with time-based filtering
                if (period === 'all') {
                    return [
                        direction(sql<number>`(
                            COALESCE((SELECT COUNT(*) FROM ${schema.appViews} WHERE ${schema.appViews.appId} = ${schema.apps.id}), 0) +
                            COALESCE((SELECT COUNT(*) * 2 FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id}), 0) +
                            COALESCE((SELECT COUNT(*) * 3 FROM ${schema.apps} AS forks WHERE forks.parent_app_id = ${schema.apps.id}), 0)
                        )`),
                        desc(schema.apps.createdAt) // Secondary sort
                    ];
                } else {
                    return [
                        direction(sql<number>`(
                            COALESCE((SELECT COUNT(*) FROM ${schema.appViews} WHERE ${schema.appViews.appId} = ${schema.apps.id} AND ${schema.appViews.viewedAt} >= ${periodThreshold.toISOString()}), 0) +
                            COALESCE((SELECT COUNT(*) * 2 FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id} AND ${schema.stars.starredAt} >= ${periodThreshold.toISOString()}), 0) +
                            COALESCE((SELECT COUNT(*) * 3 FROM ${schema.apps} AS forks WHERE forks.parent_app_id = ${schema.apps.id} AND forks.createdAt >= ${periodThreshold.toISOString()}), 0)
                        )`),
                        desc(schema.apps.createdAt)
                    ];
                }
            }

            case 'trending': {
                // Sort by trending score (popularity / age)
                if (period === 'all') {
                    return [
                        direction(sql<number>`(
                            (COALESCE((SELECT COUNT(*) FROM ${schema.appViews} WHERE ${schema.appViews.appId} = ${schema.apps.id}), 0) +
                             COALESCE((SELECT COUNT(*) * 2 FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id}), 0) +
                             COALESCE((SELECT COUNT(*) * 3 FROM ${schema.apps} AS forks WHERE forks.parent_app_id = ${schema.apps.id}), 0)) /
                            (CASE WHEN julianday('now') - julianday(${schema.apps.createdAt}) < 1 THEN 1 ELSE julianday('now') - julianday(${schema.apps.createdAt}) END)
                        )`),
                        desc(schema.apps.createdAt)
                    ];
                } else {
                    return [
                        direction(sql<number>`(
                            (COALESCE((SELECT COUNT(*) FROM ${schema.appViews} WHERE ${schema.appViews.appId} = ${schema.apps.id} AND ${schema.appViews.viewedAt} >= ${periodThreshold.toISOString()}), 0) +
                             COALESCE((SELECT COUNT(*) * 2 FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id} AND ${schema.stars.starredAt} >= ${periodThreshold.toISOString()}), 0) +
                             COALESCE((SELECT COUNT(*) * 3 FROM ${schema.apps} AS forks WHERE forks.parent_app_id = ${schema.apps.id} AND forks.createdAt >= ${periodThreshold.toISOString()}), 0)) /
                            (CASE WHEN julianday('now') - julianday(${schema.apps.createdAt}) < 1 THEN 1 ELSE julianday('now') - julianday(${schema.apps.createdAt}) END)
                        )`),
                        desc(schema.apps.createdAt)
                    ];
                }
            }

            case 'starred':
                // Sort by favorited date (most recently favorited first)
                // Note: This requires the query to already be filtered by favorites
                return [desc(sql<Date>`(SELECT ${schema.favorites.createdAt} FROM ${schema.favorites} WHERE ${schema.favorites.appId} = ${schema.apps.id})`)];

            case 'recent':
            default:
                return [direction(schema.apps.updatedAt)];
        }
    }

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