import { AnalyticsService } from '../../../database/services/AnalyticsService';
import { AppService } from '../../../database/services/AppService';
import type { BatchAppStats } from '../../../database/types';
import { formatRelativeTime } from '../../../utils/timeFormatter';
import { BaseController } from '../BaseController';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { 
    AppsListData,
    PublicAppsData,
    SingleAppData,
    FavoriteToggleData,
    CreateAppData,
    UpdateAppVisibilityData
} from './types';

export class AppController extends BaseController {
    constructor() {
        super();
    }

    // Get all apps for the current user
    async getUserApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<AppsListData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<AppsListData>>;
            }

            const dbService = this.createDbService(env);
            const appService = new AppService(dbService);
            
            // Get user's apps with favorite status using AppService
            const userApps = await appService.getUserAppsWithFavorites(authResult.user!.id);

            const responseData: AppsListData = {
                apps: userApps // Already properly typed and formatted by DatabaseService
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching user apps:', error);
            return this.createErrorResponse<AppsListData>('Failed to fetch apps', 500);
        }
    }

    // Get recent apps (last 10)
    async getRecentApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<AppsListData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<AppsListData>>;
            }

            const dbService = this.createDbService(env);
            const appService = new AppService(dbService);

            // Get recent apps using AppService
            const recentApps = await appService.getRecentAppsWithFavorites(authResult.user!.id, 10);

            const responseData: AppsListData = {
                apps: recentApps // Already properly typed and formatted by DatabaseService
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching recent apps:', error);
            return this.createErrorResponse<AppsListData>('Failed to fetch recent apps', 500);
        }
    }

    // Get favorite apps
    async getFavoriteApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<AppsListData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<AppsListData>>;
            }

            const dbService = this.createDbService(env);
            const appService = new AppService(dbService);

            // Get favorite apps using AppService
            const favoriteApps = await appService.getFavoriteAppsOnly(authResult.user!.id);

            const responseData: AppsListData = {
                apps: favoriteApps // Already properly typed and formatted by DatabaseService
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching favorite apps:', error);
            return this.createErrorResponse<AppsListData>('Failed to fetch favorite apps', 500);
        }
    }


    // Toggle favorite status
    async toggleFavorite(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<ControllerResponse<ApiResponse<FavoriteToggleData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<FavoriteToggleData>>;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse<FavoriteToggleData>('App ID is required', 400);
            }

            const dbService = this.createDbService(env);
            const appService = new AppService(dbService);
            
            // Check if app exists (no ownership check needed - users can bookmark any app)
            const ownershipResult = await appService.checkAppOwnership(appId, authResult.user!.id);
            
            if (!ownershipResult.exists) {
                return this.createErrorResponse<FavoriteToggleData>('App not found', 404);
            }

            // Toggle favorite using AppService (users can bookmark any app)
            const result = await appService.toggleAppFavorite(authResult.user!.id, appId);
            const responseData: FavoriteToggleData = result;
                
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error toggling favorite:', error);
            return this.createErrorResponse<FavoriteToggleData>('Failed to toggle favorite', 500);
        }
    }

    // Create new app
    async createApp(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<CreateAppData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<CreateAppData>>;
            }

            const body = await this.parseJsonBody(request) as { 
                title?: string; 
                description?: string; 
                framework?: string; 
                visibility?: 'private' | 'team' | 'board' | 'public' 
            };
            const { title, description, framework, visibility } = body;

            if (!title) {
                return this.createErrorResponse<CreateAppData>('Title is required', 400);
            }

            const dbService = this.createDbService(env);
            const appService = new AppService(dbService);

            const newApp = await appService.createSimpleApp({
                userId: authResult.user!.id,
                title,
                description,
                framework,
                visibility
            });

            const responseData: CreateAppData = { app: newApp };
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error creating app:', error);
            return this.createErrorResponse<CreateAppData>('Failed to create app', 500);
        }
    }

    // Get public apps feed (like a global board)
    async getPublicApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<PublicAppsData>>> {
        try {
            const dbService = this.createDbService(env);
            const url = new URL(request.url);
            
            // Pagination and filtering - handle both page and offset params
            const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
            const page = parseInt(url.searchParams.get('page') || '1');
            const offset = url.searchParams.get('offset') ? 
                parseInt(url.searchParams.get('offset') || '0') : 
                (page - 1) * limit;
            const sort = url.searchParams.get('sort') || 'recent';
            const boardId = url.searchParams.get('boardId') || undefined;
            const framework = url.searchParams.get('framework') || undefined;
            const search = url.searchParams.get('search') || undefined;
            
            // Get current user for interaction data (optional for public endpoint)
            const authResult = await this.requireAuth(request, env);
            const userId = authResult.success ? authResult.user!.id : undefined;
            
            // Get public apps using AppService
            const appService = new AppService(dbService);
            const result = await appService.getPublicAppsEnhanced({
                boardId,
                limit,
                offset,
                sort: sort as 'recent' | 'popular' | 'trending',
                framework,
                search,
                userId
            });
            const { data: apps, pagination } = result;
            
            // Handle analytics sorting if needed
            let finalApps = apps; 
            let analyticsData: BatchAppStats = {};
            
            if (sort === 'popular' || sort === 'trending') {
                // For analytics-based sorting, we need to fetch analytics for ALL apps, sort, then paginate
                // First get all apps without pagination
                const allAppsResult = await appService.getPublicAppsEnhanced({
                    boardId: boardId,
                    framework: framework,
                    search: search,
                    userId: userId,
                    limit: 1000, // Get more apps for proper sorting
                    offset: 0
                });
                
                const analyticsService = new AnalyticsService(dbService);
                const appIds = allAppsResult.data.map(app => app.id);
                analyticsData = await analyticsService.batchGetAppStats(appIds);
                
                // Add analytics data to all apps
                const appsWithAnalytics = allAppsResult.data.map(app => ({
                    ...app,
                    viewCount: analyticsData[app.id]?.viewCount || 0,
                    forkCount: analyticsData[app.id]?.forkCount || 0,
                    likeCount: analyticsData[app.id]?.likeCount || 0
                }));
                
                // Sort by analytics
                if (sort === 'popular') {
                    appsWithAnalytics.sort((a, b) => {
                        const aScore = (a.viewCount || 0) + (a.likeCount || 0) * 2 + (a.forkCount || 0) * 3;
                        const bScore = (b.viewCount || 0) + (b.likeCount || 0) * 2 + (b.forkCount || 0) * 3;
                        return bScore - aScore;
                    });
                } else if (sort === 'trending') {
                    appsWithAnalytics.sort((a, b) => {
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
                
                // Now apply pagination to sorted results
                finalApps = appsWithAnalytics.slice(offset, offset + limit);
                
                // Update pagination info to reflect correct total
                pagination.total = allAppsResult.pagination.total;
                pagination.hasMore = offset + limit < pagination.total;
            } else {
                // For non-analytics sorting, get analytics only for the current page
                const analyticsService = new AnalyticsService(dbService);
                const appIds = apps.map(app => app.id);
                analyticsData = await analyticsService.batchGetAppStats(appIds);
            }
            
            const responseData: PublicAppsData = {
                apps: finalApps.map(app => ({
                    ...app,
                    userName: app.userId ? app.userName : 'Anonymous User',
                    userAvatar: app.userId ? app.userAvatar : null,
                    updatedAtFormatted: formatRelativeTime(app.updatedAt),
                    viewCount: analyticsData[app.id]?.viewCount || 0,
                    forkCount: analyticsData[app.id]?.forkCount || 0,
                    likeCount: analyticsData[app.id]?.likeCount || 0
                })),
                pagination: {
                    total: pagination.total,
                    limit: pagination.limit,
                    offset: pagination.offset,
                    hasMore: pagination.hasMore
                }
            };
            
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching public apps:', error);
            return this.createErrorResponse<PublicAppsData>('Failed to fetch public apps', 500);
        }
    }

    // Get single app
    async getApp(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<ControllerResponse<ApiResponse<SingleAppData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<SingleAppData>>;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse<SingleAppData>('App ID is required', 400);
            }

            const dbService = this.createDbService(env);
            const appService = new AppService(dbService);
            
            const app = await appService.getSingleAppWithFavoriteStatus(appId, authResult.user!.id);

            if (!app) {
                return this.createErrorResponse<SingleAppData>('App not found', 404);
            }

            const responseData: SingleAppData = { app };
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching app:', error);
            return this.createErrorResponse<SingleAppData>('Failed to fetch app', 500);
        }
    }

    // Update app visibility
    async updateAppVisibility(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<ControllerResponse<ApiResponse<UpdateAppVisibilityData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<UpdateAppVisibilityData>>;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse<UpdateAppVisibilityData>('App ID is required', 400);
            }

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<UpdateAppVisibilityData>>;
            }
            
            const visibility = (bodyResult.data as { visibility?: string })?.visibility;

            // Validate visibility value
            if (!visibility || !['private', 'public'].includes(visibility)) {
                return this.createErrorResponse<UpdateAppVisibilityData>('Visibility must be either "private" or "public"', 400);
            }

            const validVisibility = visibility as 'private' | 'public';

            const dbService = this.createDbService(env);
            const appService = new AppService(dbService);
            
            // Update visibility using AppService
            const result = await appService.updateAppVisibility(appId, authResult.user!.id, validVisibility);

            if (!result.success) {
                const statusCode = result.error === 'App not found' ? 404 : 
                                 result.error?.includes('only change visibility of your own apps') ? 403 : 500;
                return this.createErrorResponse<UpdateAppVisibilityData>(result.error || 'Failed to update app visibility', statusCode);
            }

            const responseData: UpdateAppVisibilityData = { 
                app: {
                    ...result.app!,
                    visibility: result.app!.visibility as 'private' | 'public' | 'team' | 'board'
                },
                message: `App visibility updated to ${validVisibility}`
            };
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error updating app visibility:', error);
            return this.createErrorResponse<UpdateAppVisibilityData>('Failed to update app visibility', 500);
        }
    }
}