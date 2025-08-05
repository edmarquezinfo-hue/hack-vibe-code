import { createObjectLogger, Trace, StructuredLogger } from '../../logger';
import { AnalyticsService } from '../../database/analytics';
import { DatabaseService } from '../../database/database';
import * as schema from '../../database/schema';
import { eq, sql, and } from 'drizzle-orm';
import { BaseController } from './BaseController';

/**
 * User Management Controller for Orange
 * Handles user dashboard, profile management, and app history
 */
export class UserController extends BaseController {
    private userLogger: StructuredLogger;

    constructor() {
        super();
        this.userLogger = createObjectLogger(this, 'UserController');
    }

    /**
     * Get user dashboard data
     */
    async getDashboard(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const requestContext = Trace.startRequest(requestId, {
            endpoint: '/api/user/dashboard',
            method: 'GET',
            userAgent: request.headers.get('user-agent') || 'unknown',
            timestamp: new Date().toISOString()
        });

        try {
            this.userLogger.info('Getting user dashboard', {
                requestId,
                traceId: requestContext.getCurrentTraceId()
            });

            // Extract and verify JWT token
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const userId = authResult.user!.id;
            const dbService = this.createDbService(env);

            // Get user profile
            const user = await dbService.findUserByEmail(authResult.user!.email);
            if (!user) {
                this.userLogger.warn('User not found during dashboard request', {
                    requestId,
                    traceId: requestContext.getCurrentTraceId(),
                    userId
                });
                return this.createErrorResponse('User not found', 404);
            }

            // Get user's recent apps
            const recentApps = await dbService.getUserApps(userId, {
                limit: 10,
                offset: 0
            });

            // Get analytics for recent apps
            const analyticsService = new AnalyticsService(dbService);
            const appIds = recentApps.map(app => app.id);
            const appsAnalytics = await analyticsService.batchGetAppStats(appIds);

            // Get user's teams
            const teams = await dbService.getUserTeams(userId);

            // Get user's Cloudflare accounts
            const cloudflareAccounts = await dbService.getCloudflareAccounts(userId);

            // Calculate usage statistics
            const [totalApps, appsThisMonth] = await Promise.all([
                this.getTotalAppsCount(userId, dbService),
                this.getAppsCountThisMonth(userId, dbService)
            ]);

            this.userLogger.info('Dashboard data retrieved successfully', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                userId,
                totalApps,
                recentAppsCount: recentApps.length,
                teamsCount: teams.length
            });

            return this.createSuccessResponse({
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    bio: user.bio,
                    provider: user.provider,
                    createdAt: user.createdAt,
                    lastActiveAt: user.lastActiveAt
                },
                stats: {
                    totalApps,
                    appsThisMonth,
                    totalTeams: teams.length,
                    cloudflareAccounts: cloudflareAccounts.length
                },
                recentApps: recentApps.map(app => ({
                    id: app.id,
                    title: app.title,
                    description: app.description,
                    status: app.status,
                    visibility: app.visibility,
                    framework: app.framework,
                    deploymentUrl: app.deploymentUrl,
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt,
                    viewCount: appsAnalytics[app.id]?.viewCount || 0,
                    likeCount: appsAnalytics[app.id]?.likeCount || 0
                })),
                teams: teams.map(team => ({
                    id: team.id,
                    name: team.name,
                    slug: team.slug,
                    avatarUrl: team.avatarUrl,
                    memberRole: team.memberRole,
                    visibility: team.visibility
                })),
                cloudflareAccounts: cloudflareAccounts.map(acc => ({
                    id: acc.id,
                    name: acc.name,
                    isDefault: acc.isDefault,
                    isActive: acc.isActive,
                    createdAt: acc.createdAt
                }))
            });

        } catch (error) {
            this.userLogger.error('Failed to load dashboard', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return this.handleError(error, 'load dashboard');
        }
    }

    /**
     * Get user's apps with pagination and filtering
     */
    async getApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const requestContext = Trace.startRequest(requestId, {
            endpoint: '/api/user/apps',
            method: 'GET',
            userAgent: request.headers.get('user-agent') || 'unknown',
            timestamp: new Date().toISOString()
        });

        try {
            this.userLogger.info('Getting user apps', {
                requestId,
                traceId: requestContext.getCurrentTraceId()
            });

            // Extract and verify JWT token
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const userId = authResult.user!.id;
            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '20');
            const status = url.searchParams.get('status') || undefined;
            const visibility = url.searchParams.get('visibility') || undefined;
            const teamId = url.searchParams.get('teamId') || undefined;

            const offset = (page - 1) * limit;

            const dbService = this.createDbService(env);
            const apps = await dbService.getUserApps(userId, {
                limit,
                offset,
                status,
                visibility,
                teamId
            });

            // Get analytics for apps
            const analyticsService = new AnalyticsService(dbService);
            const appIds = apps.map(app => app.id);
            const appsAnalytics = await analyticsService.batchGetAppStats(appIds);

            this.userLogger.info('User apps retrieved successfully', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                userId,
                appsCount: apps.length,
                page,
                limit
            });

            return this.createSuccessResponse({
                apps: apps.map(app => ({
                    id: app.id,
                    title: app.title,
                    description: app.description,
                    slug: app.slug,
                    status: app.status,
                    visibility: app.visibility,
                    framework: app.framework,
                    deploymentUrl: app.deploymentUrl,
                    originalPrompt: app.originalPrompt,
                    createdAt: app.createdAt,
                    updatedAt: app.updatedAt,
                    lastDeployedAt: app.lastDeployedAt,
                    viewCount: appsAnalytics[app.id]?.viewCount || 0,
                    likeCount: appsAnalytics[app.id]?.likeCount || 0,
                    forkCount: appsAnalytics[app.id]?.forkCount || 0,
                    // tags: app.tags // TODO: Implement tags when available
                })),
                pagination: {
                    page,
                    limit,
                    total: apps.length,
                    hasMore: apps.length === limit
                }
            });

        } catch (error) {
            this.userLogger.error('Failed to get user apps', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return this.handleError(error, 'get user apps');
        }
    }

    /**
     * Create or associate a CodeGeneratorAgent session with the user
     */
    async createAgentSession(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const requestContext = Trace.startRequest(requestId, {
            endpoint: '/api/user/sessions',
            method: 'POST',
            userAgent: request.headers.get('user-agent') || 'unknown',
            timestamp: new Date().toISOString()
        });

        try {
            this.userLogger.info('Creating agent session', {
                requestId,
                traceId: requestContext.getCurrentTraceId()
            });

            // Extract and verify JWT token
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const userId = authResult.user!.id;

            let body: {
                agentId: string;
                prompt: string;
                title?: string;
                description?: string;
                framework?: string;
            };

            try {
                body = await request.json();
            } catch (error) {
                return this.createErrorResponse('Invalid JSON in request body', 400);
            }

            const { agentId, prompt, title, description, framework } = body;

            if (!agentId || !prompt) {
                return this.createErrorResponse('Agent ID and prompt are required', 400);
            }

            const dbService = this.createDbService(env);

            // Create app record associated with the agent
            const app = await dbService.createApp({
                title: title || `Generated App ${new Date().toLocaleString()}`,
                description: description || 'Generated from conversation',
                originalPrompt: prompt,
                userId,
                status: 'generating',
                visibility: 'private',
                framework: framework || 'react'
            });

            // Create code generation instance tied to the agent
            const codeGenInstance = await dbService.createCodeGenInstance({
                appId: app.id,
                userId,
                currentPhase: 'planning',
                isGenerating: true,
                status: 'active'
            });

            this.userLogger.info('Agent session created successfully', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                userId,
                agentId,
                appId: app.id,
                instanceId: codeGenInstance.id
            });

            // The agentId serves as our session identifier
            // The durable object will maintain the actual generation state
            return this.createSuccessResponse({
                app: {
                    id: app.id,
                    title: app.title,
                    status: app.status
                },
                codeGenInstance: {
                    id: codeGenInstance.id,
                    agentId, // This is the durable object ID
                    status: codeGenInstance.status,
                    currentPhase: codeGenInstance.currentPhase
                }
            });

        } catch (error) {
            this.userLogger.error('Failed to create agent session', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return this.handleError(error, 'create agent session');
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const requestContext = Trace.startRequest(requestId, {
            endpoint: '/api/user/profile',
            method: 'PUT',
            userAgent: request.headers.get('user-agent') || 'unknown',
            timestamp: new Date().toISOString()
        });

        try {
            this.userLogger.info('Updating user profile', {
                requestId,
                traceId: requestContext.getCurrentTraceId()
            });

            // Extract and verify JWT token
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const userId = authResult.user!.id;

            let body: {
                username?: string;
                displayName?: string;
                bio?: string;
                theme?: string;
            };

            try {
                body = await request.json();
            } catch (error) {
                return this.createErrorResponse('Invalid JSON in request body', 400);
            }

            const { username, displayName, bio, theme } = body;
            const dbService = this.createDbService(env);

            // Validate username format and uniqueness if provided
            if (username) {
                // Validate username format
                if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                    return this.createErrorResponse('Username can only contain letters, numbers, underscores, and hyphens', 400);
                }
                
                if (username.length < 3 || username.length > 30) {
                    return this.createErrorResponse('Username must be between 3 and 30 characters', 400);
                }
                
                // Check against reserved usernames
                const reservedUsernames = ['admin', 'api', 'www', 'mail', 'ftp', 'root', 'support', 'help', 'about', 'terms', 'privacy'];
                if (reservedUsernames.includes(username.toLowerCase())) {
                    return this.createErrorResponse('Username is reserved', 400);
                }
                
                const existingUser = await dbService.db
                    .select()
                    .from(schema.users)
                    .where(eq(schema.users.username, username))
                    .limit(1);

                if (existingUser.length > 0 && existingUser[0].id !== userId) {
                    return this.createErrorResponse('Username already taken', 400);
                }
            }

            // Update user profile
            await dbService.db
                .update(schema.users)
                .set({
                    username: username || undefined,
                    displayName: displayName || undefined,
                    bio: bio || undefined,
                    theme: theme as 'light' | 'dark' | 'system' | undefined,
                    updatedAt: new Date()
                })
                .where(eq(schema.users.id, userId));

            this.userLogger.info('User profile updated successfully', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                userId,
                fieldsUpdated: Object.keys(body).filter(key => body[key as keyof typeof body] !== undefined)
            });

            return this.createSuccessResponse({
                success: true,
                message: 'Profile updated successfully'
            });

        } catch (error) {
            this.userLogger.error('Failed to update user profile', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return this.handleError(error, 'update user profile');
        }
    }

    /**
     * Get user's teams
     */
    async getTeams(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        const requestId = crypto.randomUUID();
        const requestContext = Trace.startRequest(requestId, {
            endpoint: '/api/user/teams',
            method: 'GET',
            userAgent: request.headers.get('user-agent') || 'unknown',
            timestamp: new Date().toISOString()
        });

        try {
            this.userLogger.info('Getting user teams', {
                requestId,
                traceId: requestContext.getCurrentTraceId()
            });

            // Extract and verify JWT token
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const userId = authResult.user!.id;
            const dbService = this.createDbService(env);
            
            const teams = await dbService.getUserTeams(userId);

            this.userLogger.info('User teams retrieved successfully', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                userId,
                teamsCount: teams.length
            });

            return this.createSuccessResponse({
                teams: teams.map(team => ({
                    id: team.id,
                    name: team.name,
                    slug: team.slug,
                    description: team.description,
                    avatarUrl: team.avatarUrl,
                    visibility: team.visibility,
                    memberRole: team.memberRole,
                    plan: team.plan,
                    createdAt: team.createdAt
                }))
            });

        } catch (error) {
            this.userLogger.error('Failed to get user teams', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            return this.handleError(error, 'get user teams');
        }
    }

    // Private helper methods

    private async getTotalAppsCount(userId: string, dbService: DatabaseService): Promise<number> {
        const result = await dbService.db
            .select({ count: sql`COUNT(*)` })
            .from(schema.apps)
            .where(eq(schema.apps.userId, userId));
        
        return Number(result[0]?.count) || 0;
    }

    private async getAppsCountThisMonth(userId: string, dbService: DatabaseService): Promise<number> {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const result = await dbService.db
            .select({ count: sql`COUNT(*)` })
            .from(schema.apps)
            .where(and(
                eq(schema.apps.userId, userId),
                sql`${schema.apps.createdAt} >= ${startOfMonth}`
            ));
        
        return Number(result[0]?.count) || 0;
    }
}
