
import { BaseController } from '../BaseController';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { UserService } from '../../../database/services/UserService';
import type { AppSortOption, SortOrder, TimePeriod } from '../../../database/types';
import { 
    DashboardData, 
    UserAppsData, 
    AgentSessionData, 
    ProfileUpdateData, 
    UserTeamsData
} from './types';

/**
 * User Management Controller for Orange
 * Handles user dashboard, profile management, and app history
 */
export class UserController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get user dashboard data
     */
    async getDashboard(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<DashboardData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<DashboardData>>;
            }

            const dbService = this.createDbService(env);
            const userService = new UserService(dbService);
            
            // Get comprehensive dashboard data using user service
            const dashboardData = await userService.getUserDashboardData(authResult.user!.id);

            const responseData: DashboardData = {
                user: dashboardData.user!,
                stats: dashboardData.stats,
                recentApps: dashboardData.recentApps,
                teams: dashboardData.teams,
                cloudflareAccounts: dashboardData.cloudflareAccounts
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error loading user dashboard:', error);
            return this.createErrorResponse<DashboardData>('Failed to load dashboard', 500);
        }
    }

    /**
     * Get user's apps with pagination and filtering
     */
    async getApps(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<UserAppsData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<UserAppsData>>;
            }

            const url = new URL(request.url);
            const page = parseInt(url.searchParams.get('page') || '1');
            const limit = parseInt(url.searchParams.get('limit') || '20');
            const status = url.searchParams.get('status') as 'generating' | 'completed' | undefined;
            const visibility = url.searchParams.get('visibility') as 'private' | 'public' | 'team' | 'board' | undefined;
            const teamId = url.searchParams.get('teamId') || undefined;
            const framework = url.searchParams.get('framework') || undefined;
            const search = url.searchParams.get('search') || undefined;
            const sort = (url.searchParams.get('sort') || 'recent') as AppSortOption;
            const order = (url.searchParams.get('order') || 'desc') as SortOrder;
            const period = (url.searchParams.get('period') || 'all') as TimePeriod;
            const offset = (page - 1) * limit;

            const dbService = this.createDbService(env);
            const userService = new UserService(dbService);
            
            const queryOptions = {
                limit,
                offset,
                status,
                visibility,
                teamId,
                framework,
                search,
                sort,
                order,
                period
            };
            
            // Get user apps with analytics and proper total count
            const [apps, totalCount] = await Promise.all([
                userService.getUserAppsWithAnalytics(authResult.user!.id, queryOptions),
                userService.getUserAppsCount(authResult.user!.id, queryOptions)
            ]);

            const responseData: UserAppsData = {
                apps,
                pagination: {
                    limit,
                    offset,
                    total: totalCount,
                    hasMore: offset + limit < totalCount
                }
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting user apps:', error);
            return this.createErrorResponse<UserAppsData>('Failed to get user apps', 500);
        }
    }

    /**
     * Create or associate a CodeGeneratorAgent session with the user
     */
    async createAgentSession(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<AgentSessionData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<AgentSessionData>>;
            }

            const bodyResult = await this.parseJsonBody<{
                agentId: string;
                prompt: string;
                title?: string;
                description?: string;
                framework?: string;
            }>(request);

            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<AgentSessionData>>;
            }

            const { agentId, prompt, title, description, framework } = bodyResult.data!;

            if (!agentId || !prompt) {
                return this.createErrorResponse<AgentSessionData>('Agent ID and prompt are required', 400);
            }

            const dbService = this.createDbService(env);
            const userService = new UserService(dbService);
            
            // Create app session using user service
            const sessionResult = await userService.createAppSession(authResult.user!.id, {
                agentId,
                prompt,
                title,
                description,
                framework
            });

            const responseData: AgentSessionData = {
                app: sessionResult.app,
                codeGenInstance: sessionResult.codeGenInstance
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error creating agent session:', error);
            return this.createErrorResponse<AgentSessionData>('Failed to create agent session', 500);
        }
    }

    /**
     * Update user profile
     */
    async updateProfile(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<ProfileUpdateData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<ProfileUpdateData>>;
            }

            const bodyResult = await this.parseJsonBody<{
                username?: string;
                displayName?: string;
                bio?: string;
                theme?: 'light' | 'dark' | 'system';
            }>(request);

            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<ProfileUpdateData>>;
            }

            const dbService = this.createDbService(env);
            const userService = new UserService(dbService);
            
            // Update profile with validation using user service
            const result = await userService.updateUserProfileWithValidation(authResult.user!.id, bodyResult.data!);

            if (!result.success) {
                return this.createErrorResponse<ProfileUpdateData>(result.message, 400);
            }

            const responseData: ProfileUpdateData = result;
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error updating user profile:', error);
            return this.createErrorResponse<ProfileUpdateData>('Failed to update profile', 500);
        }
    }

    /**
     * Get user's teams
     */
    async getTeams(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<UserTeamsData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<UserTeamsData>>;
            }

            const dbService = this.createDbService(env);
            const userService = new UserService(dbService);
            const teams = await userService.getUserTeams(authResult.user!.id);

            const responseData: UserTeamsData = { teams };
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting user teams:', error);
            return this.createErrorResponse<UserTeamsData>('Failed to get user teams', 500);
        }
    }

}

// Export singleton instance
export const userController = new UserController();
