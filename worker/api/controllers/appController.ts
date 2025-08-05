import { AnalyticsService } from '../../database/analytics';
import * as schema from '../../database/schema';
import { eq, desc, and, sql, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { BaseController } from './BaseController';

export class AppController extends BaseController {
    constructor() {
        super();
    }

    // Get all apps for the current user
    async getUserApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const dbService = this.createDbService(env);
            
            // Get user's apps with favorite status
            const userApps = await dbService.db
                .select({
                    id: schema.apps.id,
                    title: schema.apps.title,
                    description: schema.apps.description,
                    framework: schema.apps.framework,
                    visibility: schema.apps.visibility,
                    iconUrl: schema.apps.iconUrl,
                    createdAt: schema.apps.createdAt,
                    updatedAt: schema.apps.updatedAt,
                    isFavorite: sql<boolean>`
                        EXISTS (
                            SELECT 1 FROM ${schema.favorites} 
                            WHERE ${schema.favorites.userId} = ${authResult.user!.id} 
                            AND ${schema.favorites.appId} = ${schema.apps.id}
                        )
                    `.as('isFavorite')
                })
                .from(schema.apps)
                .where(eq(schema.apps.userId, authResult.user!.id))
                .orderBy(desc(schema.apps.updatedAt));

            return this.createSuccessResponse({
                apps: userApps.map((app: any) => ({
                    ...app,
                    updatedAt: app.updatedAt ? getRelativeTime(app.updatedAt) : 'Unknown'
                }))
            });
        } catch (error) {
            console.error('Error fetching user apps:', error);
            return this.createErrorResponse('Failed to fetch apps', 500);
        }
    }

    // Get recent apps (last 10)
    async getRecentApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const dbService = this.createDbService(env);

            const recentApps = await dbService.db
                .select({
                    id: schema.apps.id,
                    title: schema.apps.title,
                    description: schema.apps.description,
                    framework: schema.apps.framework,
                    visibility: schema.apps.visibility,
                    iconUrl: schema.apps.iconUrl,
                    createdAt: schema.apps.createdAt,
                    updatedAt: schema.apps.updatedAt,
                    isFavorite: sql<boolean>`
                        EXISTS (
                            SELECT 1 FROM ${schema.favorites} 
                            WHERE ${schema.favorites.userId} = ${authResult.user!.id} 
                            AND ${schema.favorites.appId} = ${schema.apps.id}
                        )
                    `.as('isFavorite')
                })
                .from(schema.apps)
                .where(eq(schema.apps.userId, authResult.user!.id))
                .orderBy(desc(schema.apps.updatedAt))
                .limit(10);

            return this.createSuccessResponse({
                apps: recentApps.map((app: any) => ({
                    ...app,
                    updatedAt: app.updatedAt ? getRelativeTime(app.updatedAt) : 'Unknown'
                }))
            });
        } catch (error) {
            console.error('Error fetching recent apps:', error);
            return this.createErrorResponse('Failed to fetch recent apps', 500);
        }
    }

    // Get favorite apps
    async getFavoriteApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const dbService = this.createDbService(env);

            const favoriteApps = await dbService.db
                .select({
                    id: schema.apps.id,
                    title: schema.apps.title,
                    description: schema.apps.description,
                    framework: schema.apps.framework,
                    visibility: schema.apps.visibility,
                    iconUrl: schema.apps.iconUrl,
                    createdAt: schema.apps.createdAt,
                    updatedAt: schema.apps.updatedAt,
                })
                .from(schema.apps)
                .innerJoin(schema.favorites, and(
                    eq(schema.favorites.appId, schema.apps.id),
                    eq(schema.favorites.userId, authResult.user!.id)
                ))
                .where(eq(schema.apps.userId, authResult.user!.id))
                .orderBy(desc(schema.apps.updatedAt));

            return this.createSuccessResponse({
                apps: favoriteApps.map((app: any) => ({
                    ...app,
                    isFavorite: true,
                    updatedAt: app.updatedAt ? getRelativeTime(app.updatedAt) : 'Unknown'
                }))
            });
        } catch (error) {
            console.error('Error fetching favorite apps:', error);
            return this.createErrorResponse('Failed to fetch favorite apps', 500);
        }
    }

    // Toggle favorite status
    async toggleFavorite(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse('App ID is required', 400);
            }

            const dbService = this.createDbService(env);
            
            // Check if app belongs to user
            const app = await dbService.db
                .select()
                .from(schema.apps)
                .where(and(
                    eq(schema.apps.id, appId),
                    eq(schema.apps.userId, authResult.user!.id)
                ))
                .limit(1);

            if (!app.length) {
                return this.createErrorResponse('App not found', 404);
            }

            // Check if already favorited
            const existingFavorite = await dbService.db
                .select()
                .from(schema.favorites)
                .where(and(
                    eq(schema.favorites.appId, appId),
                    eq(schema.favorites.userId, authResult.user!.id)
                ))
                .limit(1);

            if (existingFavorite.length) {
                // Remove favorite
                await dbService.db
                    .delete(schema.favorites)
                    .where(and(
                        eq(schema.favorites.appId, appId),
                        eq(schema.favorites.userId, authResult.user!.id)
                    ));
                
                return this.createSuccessResponse({ isFavorite: false });
            } else {
                // Add favorite
                await dbService.db
                    .insert(schema.favorites)
                    .values({
                        id: nanoid(),
                        userId: authResult.user!.id,
                        appId: appId,
                        createdAt: new Date()
                    });
                
                return this.createSuccessResponse({ isFavorite: true });
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
            return this.createErrorResponse('Failed to toggle favorite', 500);
        }
    }

    // Create new app
    async createApp(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const body = await this.parseJsonBody(request) as { 
                title?: string; 
                description?: string; 
                framework?: string; 
                visibility?: 'private' | 'team' | 'board' | 'public' 
            };
            const { title, description, framework, visibility } = body;

            if (!title) {
                return this.createErrorResponse('Title is required', 400);
            }

            const dbService = this.createDbService(env);

            const newApp = await dbService.db
                .insert(schema.apps)
                .values({
                    id: nanoid(),
                    userId: authResult.user!.id,
                    title,
                    description: description || null,
                    framework: framework || 'react',
                    visibility: visibility || 'private',
                    iconUrl: null,
                    originalPrompt: title, // Use title as original prompt for now
                    createdAt: new Date(),
                    updatedAt: new Date()
                })
                .returning();

            return this.createSuccessResponse({ app: newApp[0] });
        } catch (error) {
            console.error('Error creating app:', error);
            return this.createErrorResponse('Failed to create app', 500);
        }
    }

    // Get public apps feed (like a global board)
    async getPublicApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        try {
            const dbService = this.createDbService(env);
            const url = new URL(request.url);
            
            // Pagination and filtering
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
            const offset = parseInt(url.searchParams.get('offset') || '0');
            const sort = url.searchParams.get('sort') || 'recent';
            const framework = url.searchParams.get('framework');
            const search = url.searchParams.get('search');
            
            // Get current user for interaction data (optional for public endpoint)
            const authResult = await this.requireAuth(request, env);
            const user = authResult.success ? authResult.user : null;
            
            // Build query conditions
            const conditions: any[] = [
                eq(schema.apps.visibility, 'public'),
                eq(schema.apps.status, 'completed')
            ];
            
            if (framework) {
                conditions.push(eq(schema.apps.framework, framework));
            }
            
            if (search) {
                // Use parameterized queries to prevent SQL injection
                const searchTerm = `%${search.toLowerCase()}%`;
                conditions.push(
                    or(
                        sql`LOWER(${schema.apps.title}) LIKE ${searchTerm}`,
                        sql`LOWER(${schema.apps.description}) LIKE ${searchTerm}`
                    )
                );
            }
            
            // For popular/trending, we need to fetch apps first and then sort by analytics
            // For recent, we can sort by createdAt directly
            const orderByClause = desc(schema.apps.createdAt);
            const useAnalyticsSorting = sort === 'popular' || sort === 'trending';
            
            // Fetch apps with appropriate pagination
            const apps = useAnalyticsSorting 
                ? await dbService.db
                        .select({
                            id: schema.apps.id,
                            title: schema.apps.title,
                            description: schema.apps.description,
                            framework: schema.apps.framework,
                            deploymentUrl: schema.apps.deploymentUrl,
                            createdAt: schema.apps.createdAt,
                            updatedAt: schema.apps.updatedAt,
                            userId: schema.apps.userId,
                            userName: schema.users.displayName,
                            userAvatar: schema.users.avatarUrl,
                            starCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id}), 0)`,
                            userStarred: user ? sql<boolean>`EXISTS(SELECT 1 FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id} AND ${schema.stars.userId} = ${user.id})` : sql<boolean>`false`,
                            userFavorited: user ? sql<boolean>`EXISTS(SELECT 1 FROM ${schema.favorites} WHERE ${schema.favorites.appId} = ${schema.apps.id} AND ${schema.favorites.userId} = ${user.id})` : sql<boolean>`false`
                        })
                        .from(schema.apps)
                        .leftJoin(schema.users, eq(schema.apps.userId, schema.users.id))
                        .where(and(...conditions))
                        .orderBy(orderByClause)
                : await dbService.db
                        .select({
                            id: schema.apps.id,
                            title: schema.apps.title,
                            description: schema.apps.description,
                            framework: schema.apps.framework,
                            deploymentUrl: schema.apps.deploymentUrl,
                            createdAt: schema.apps.createdAt,
                            updatedAt: schema.apps.updatedAt,
                            userId: schema.apps.userId,
                            userName: schema.users.displayName,
                            userAvatar: schema.users.avatarUrl,
                            starCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id}), 0)`,
                            userStarred: user ? sql<boolean>`EXISTS(SELECT 1 FROM ${schema.stars} WHERE ${schema.stars.appId} = ${schema.apps.id} AND ${schema.stars.userId} = ${user.id})` : sql<boolean>`false`,
                            userFavorited: user ? sql<boolean>`EXISTS(SELECT 1 FROM ${schema.favorites} WHERE ${schema.favorites.appId} = ${schema.apps.id} AND ${schema.favorites.userId} = ${user.id})` : sql<boolean>`false`
                        })
                        .from(schema.apps)
                        .leftJoin(schema.users, eq(schema.apps.userId, schema.users.id))
                        .where(and(...conditions))
                        .orderBy(orderByClause)
                        .limit(limit)
                        .offset(offset);
            
            // Get analytics data if needed for sorting
            let finalApps = apps;
            if (useAnalyticsSorting) {
                const analyticsService = new AnalyticsService(dbService);
                const appIds = apps.map(app => app.id);
                const analyticsData = await analyticsService.batchGetAppStats(appIds);
                
                // Add analytics data to apps
                const appsWithAnalytics = apps.map(app => ({
                    ...app,
                    viewCount: analyticsData[app.id]?.viewCount || 0,
                    forkCount: analyticsData[app.id]?.forkCount || 0,
                    likeCount: analyticsData[app.id]?.likeCount || 0
                }));
                
                // Sort by analytics
                if (sort === 'popular') {
                    appsWithAnalytics.sort((a, b) => {
                        // Popular = views + likes + forks (weighted)
                        const aScore = (a.viewCount || 0) + (a.likeCount || 0) * 2 + (a.forkCount || 0) * 3;
                        const bScore = (b.viewCount || 0) + (b.likeCount || 0) * 2 + (b.forkCount || 0) * 3;
                        return bScore - aScore;
                    });
                } else if (sort === 'trending') {
                    appsWithAnalytics.sort((a, b) => {
                        // Trending = popularity score / age in days (higher is better)
                        const now = Date.now();
                        const aCreatedAt = a.createdAt ? new Date(a.createdAt).getTime() : now;
                        const bCreatedAt = b.createdAt ? new Date(b.createdAt).getTime() : now;
                        const aDays = Math.max(1, (now - aCreatedAt) / (1000 * 60 * 60 * 24));
                        const bDays = Math.max(1, (now - bCreatedAt) / (1000 * 60 * 60 * 24));
                        
                        const aScore = ((a.viewCount || 0) + (a.likeCount || 0) * 2 + (a.forkCount || 0) * 3) / Math.log10(aDays + 1);
                        const bScore = ((b.viewCount || 0) + (b.likeCount || 0) * 2 + (b.forkCount || 0) * 3) / Math.log10(bDays + 1);
                        
                        return bScore - aScore;
                    });
                }
                
                // Apply pagination after sorting
                finalApps = appsWithAnalytics.slice(offset, offset + limit);
            }
            
            // Get total count
            const totalCountResult = await dbService.db
                .select({ count: sql<number>`COUNT(*)` })
                .from(schema.apps)
                .where(and(...conditions));
            
            const totalCount = totalCountResult[0]?.count || 0;
            
            return this.createSuccessResponse({
                apps: finalApps.map((app: any) => ({
                    ...app,
                    userName: app.userId ? app.userName : 'Anonymous User',
                    userAvatar: app.userId ? app.userAvatar : null,
                    updatedAt: app.updatedAt ? getRelativeTime(app.updatedAt) : 'Unknown',
                    viewCount: app.viewCount || 0,
                    forkCount: app.forkCount || 0,
                    likeCount: app.likeCount || 0
                })),
                pagination: {
                    total: totalCount,
                    limit,
                    offset,
                    hasMore: offset + limit < totalCount
                }
            });
        } catch (error) {
            console.error('Error fetching public apps:', error);
            return this.createErrorResponse('Failed to fetch public apps', 500);
        }
    }

    // Get single app
    async getApp(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse('App ID is required', 400);
            }

            const dbService = this.createDbService(env);
            
            const app = await dbService.db
                .select({
                    id: schema.apps.id,
                    title: schema.apps.title,
                    description: schema.apps.description,
                    framework: schema.apps.framework,
                    visibility: schema.apps.visibility,
                    iconUrl: schema.apps.iconUrl,
                    createdAt: schema.apps.createdAt,
                    updatedAt: schema.apps.updatedAt,
                    isFavorite: sql<boolean>`
                        EXISTS (
                            SELECT 1 FROM ${schema.favorites} 
                            WHERE ${schema.favorites.userId} = ${authResult.user!.id} 
                            AND ${schema.favorites.appId} = ${schema.apps.id}
                        )
                    `.as('isFavorite')
                })
                .from(schema.apps)
                .where(and(
                    eq(schema.apps.id, appId),
                    eq(schema.apps.userId, authResult.user!.id)
                ))
                .limit(1);

            if (!app.length) {
                return this.createErrorResponse('App not found', 404);
            }

            return this.createSuccessResponse({ 
                app: {
                    ...app[0],
                    updatedAt: app[0].updatedAt ? getRelativeTime(app[0].updatedAt) : 'Unknown'
                }
            });
        } catch (error) {
            console.error('Error fetching app:', error);
            return this.createErrorResponse('Failed to fetch app', 500);
        }
    }

    // Update app visibility
    async updateAppVisibility(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse('App ID is required', 400);
            }

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }
            
            const visibility = (bodyResult.data as { visibility?: string })?.visibility;

            // Validate visibility value
            if (!visibility || !['private', 'public'].includes(visibility)) {
                return this.createErrorResponse('Visibility must be either "private" or "public"', 400);
            }

            const validVisibility = visibility as 'private' | 'public';

            const dbService = this.createDbService(env);
            
            // Check if app exists and user owns it
            const existingApp = await dbService.db
                .select({
                    id: schema.apps.id,
                    userId: schema.apps.userId,
                    visibility: schema.apps.visibility
                })
                .from(schema.apps)
                .where(eq(schema.apps.id, appId))
                .limit(1);

            if (!existingApp.length) {
                return this.createErrorResponse('App not found', 404);
            }

            // Verify ownership
            if (existingApp[0].userId !== authResult.user!.id) {
                return this.createErrorResponse('You can only change visibility of your own apps', 403);
            }

            // Update the app visibility
            const updatedApp = await dbService.db
                .update(schema.apps)
                .set({
                    visibility: validVisibility,
                    updatedAt: new Date()
                })
                .where(eq(schema.apps.id, appId))
                .returning({
                    id: schema.apps.id,
                    title: schema.apps.title,
                    visibility: schema.apps.visibility,
                    updatedAt: schema.apps.updatedAt
                });

            if (!updatedApp.length) {
                return this.createErrorResponse('Failed to update app visibility', 500);
            }

            return this.createSuccessResponse({ 
                app: updatedApp[0],
                message: `App visibility updated to ${validVisibility}`
            });
        } catch (error) {
            console.error('Error updating app visibility:', error);
            return this.createErrorResponse('Failed to update app visibility', 500);
        }
    }
}

// Helper function to get relative time
function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}

// Export singleton instance
export const appController = new AppController();