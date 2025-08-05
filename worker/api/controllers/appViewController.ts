import * as schema from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { BaseController } from './BaseController';

export class AppViewController extends BaseController {
    constructor() {
        super();
    }

    // Get single app details (public endpoint, auth optional for ownership check)
    async getAppDetails(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<Response> {
    try {
        const appId = params?.id;
        if (!appId) {
            return this.createErrorResponse('App ID is required', 400);
        }

        const dbService = this.createDbService(env);
        
        // Try to get user if authenticated (optional for public endpoint)
        const authResult = await this.requireAuth(request, env);
        const userId = authResult.success ? authResult.user!.id : null;

        // Get app with user info
        const appResult = await dbService.db
            .select({
                id: schema.apps.id,
                title: schema.apps.title,
                description: schema.apps.description,
                framework: schema.apps.framework,
                visibility: schema.apps.visibility,
                deploymentUrl: schema.apps.deploymentUrl,
                createdAt: schema.apps.createdAt,
                updatedAt: schema.apps.updatedAt,
                userId: schema.apps.userId,
                userName: schema.users.displayName,
                userAvatar: schema.users.avatarUrl,
                blueprint: schema.apps.blueprint,
                generatedFiles: schema.apps.generatedFiles
            })
            .from(schema.apps)
            .leftJoin(schema.users, eq(schema.apps.userId, schema.users.id))
            .where(eq(schema.apps.id, appId))
            .get();

        if (!appResult) {
            return this.createErrorResponse('App not found', 404);
        }

        // For now, use deploymentUrl from apps table as cloudflareUrl
        const cloudflareUrl = appResult.deploymentUrl;

        // Check if user has permission to view
        if (appResult.visibility === 'private' && appResult.userId !== userId) {
            return this.createErrorResponse('App not found', 404);
        }

        // Get stats
        const [viewCount, starCount, isFavorite, userHasStarred] = await Promise.all([
            // Get view count
            dbService.db
                .select({ count: sql<number>`count(*)` })
                .from(schema.appViews)
                .where(eq(schema.appViews.appId, appId))
                .get()
                .then(r => r?.count || 0),
            
            // Get star count
            dbService.db
                .select({ count: sql<number>`count(*)` })
                .from(schema.stars)
                .where(eq(schema.stars.appId, appId))
                .get()
                .then(r => r?.count || 0),
            
            // Check if favorited by current user
            userId ? dbService.db
                .select({ id: schema.favorites.id })
                .from(schema.favorites)
                .where(and(
                    eq(schema.favorites.userId, userId),
                    eq(schema.favorites.appId, appId)
                ))
                .get()
                .then(r => !!r) : false,
            
            // Check if starred by current user
            userId ? dbService.db
                .select({ id: schema.stars.id })
                .from(schema.stars)
                .where(and(
                    eq(schema.stars.userId, userId),
                    eq(schema.stars.appId, appId)
                ))
                .get()
                .then(r => !!r) : false
        ]);

        // Track view (if not owner)
        if (userId && userId !== appResult.userId) {
            try {
                await dbService.db
                    .insert(schema.appViews)
                    .values({
                        id: nanoid(),
                        appId,
                        userId,
                        viewedAt: new Date()
                    })
                    .run();
            } catch {
                // Ignore duplicate view errors
            }
        }

        // Try to fetch current agent state to get latest generated code
        let generatedCode = appResult.generatedFiles ? Object.values(appResult.generatedFiles) : [];
        
        try {
            // Import the agent utilities
            const { getAgentByName } = await import('agents');
            
            // Get the agent instance for this app
            const agentInstance = await getAgentByName(env.CodeGenObject, appResult.id);
            const agentProgress = await agentInstance.getProgress();
            
            if (agentProgress && agentProgress.generated_code && agentProgress.generated_code.length > 0) {
                // Convert agent progress format to expected frontend format
                generatedCode = agentProgress.generated_code.map((file: { file_path: string; file_contents: string; explanation?: string }) => ({
                    file_path: file.file_path,
                    file_contents: file.file_contents,
                    explanation: file.explanation
                }));
            }
        } catch (agentError) {
            // If agent doesn't exist or error occurred, fall back to database stored files
            console.log('Could not fetch agent state, using stored files:', agentError);
        }

        return this.createSuccessResponse({
            id: appResult.id,
            title: appResult.title,
            description: appResult.description,
            framework: appResult.framework,
            visibility: appResult.visibility,
            cloudflareUrl,
            previewUrl: appResult.deploymentUrl,
            createdAt: appResult.createdAt,
            updatedAt: appResult.updatedAt,
            userId: appResult.userId,
            user: {
                id: appResult.userId,
                displayName: appResult.userName || 'Unknown',
                avatarUrl: appResult.userAvatar
            },
            views: viewCount,
            stars: starCount,
            isFavorite,
            userHasStarred,
            blueprint: appResult.blueprint,
            generatedCode
        });
    } catch (error) {
        console.error('Error fetching app details:', error);
        return this.createErrorResponse('Internal server error', 500);
    }
}

    // Star/unstar an app
    async toggleAppStar(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<Response> {
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

        // Check if app exists
        const app = await dbService.db
            .select({ id: schema.apps.id })
            .from(schema.apps)
            .where(eq(schema.apps.id, appId))
            .get();

        if (!app) {
            return this.createErrorResponse('App not found', 404);
        }

        // Check if already starred
        const existingStar = await dbService.db
            .select({ id: schema.stars.id })
            .from(schema.stars)
            .where(and(
                eq(schema.stars.userId, authResult.user!.id),
                eq(schema.stars.appId, appId)
            ))
            .get();

        if (existingStar) {
            // Unstar
            await dbService.db
                .delete(schema.stars)
                .where(eq(schema.stars.id, existingStar.id))
                .run();
        } else {
            // Star
            await dbService.db
                .insert(schema.stars)
                .values({
                    id: nanoid(),
                    userId: authResult.user!.id,
                    appId,
                    starredAt: new Date()
                })
                .run();
        }

        // Get updated star count
        const starCount = await dbService.db
            .select({ count: sql<number>`count(*)` })
            .from(schema.stars)
            .where(eq(schema.stars.appId, appId))
            .get()
            .then(r => r?.count || 0);

        return this.createSuccessResponse({
            isStarred: !existingStar,
            starCount
        });
    } catch (error) {
        console.error('Error toggling star:', error);
        return this.createErrorResponse('Internal server error', 500);
    }
}

    // Fork an app
    async forkApp(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<Response> {
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

        // Get original app
        const originalApp = await dbService.db
            .select()
            .from(schema.apps)
            .where(eq(schema.apps.id, appId))
            .get();

        if (!originalApp) {
            return this.createErrorResponse('App not found', 404);
        }

        // Check visibility permissions
        if (originalApp.visibility === 'private' && originalApp.userId !== authResult.user!.id) {
            return this.createErrorResponse('App not found', 404);
        }

        // Create forked app
        const forkedAppId = nanoid();
        const now = new Date().toISOString();
        
        await dbService.db
            .insert(schema.apps)
            .values({
                id: forkedAppId,
                userId: authResult.user!.id,
                title: `${originalApp.title} (Fork)`,
                description: originalApp.description,
                originalPrompt: originalApp.originalPrompt,
                finalPrompt: originalApp.finalPrompt,
                framework: originalApp.framework,
                visibility: 'private', // Forks start as private
                status: 'completed', // Forked apps start as completed
                parentAppId: originalApp.id,
                blueprint: originalApp.blueprint,
                generatedFiles: originalApp.generatedFiles,
                createdAt: new Date(now),
                updatedAt: new Date(now)
            })
            .run();

        return this.createSuccessResponse({
            forkedAppId,
            message: 'App forked successfully'
        });
    } catch (error) {
        console.error('Error forking app:', error);
        return this.createErrorResponse('Internal server error', 500);
    }
    }
}

// Export singleton instance
export const appViewController = new AppViewController();