
import { BaseController } from '../BaseController';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { cloneAgent, getAgentStub } from '../../../agents';
import { AppService } from '../../../database/services/AppService';
import { 
    AppDetailsData, 
    AppStarToggleData, 
    ForkAppData, 
    GeneratedCodeFile 
} from './types';

export class AppViewController extends BaseController {
    constructor() {
        super();
    }

    // Get single app details (public endpoint, auth optional for ownership check)
    async getAppDetails(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<ControllerResponse<ApiResponse<AppDetailsData>>> {
        try {
            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse<AppDetailsData>('App ID is required', 400);
            }

            const dbService = this.createDbService(env);
            
            // Try to get user if authenticated (optional for public endpoint)
            const authResult = await this.requireAuth(request, env);
            const userId = authResult.success ? authResult.user!.id : undefined;

            // Get app details with stats using app service
            const appService = new AppService(dbService);
            const appResult = await appService.getAppDetailsEnhanced(appId, userId);

            if (!appResult) {
                return this.createErrorResponse<AppDetailsData>('App not found', 404);
            }

            // Check if user has permission to view
            if (appResult.visibility === 'private' && appResult.userId !== userId) {
                return this.createErrorResponse<AppDetailsData>('App not found', 404);
            }

            // Track view (if not owner)
            if (userId && userId !== appResult.userId) {
                await appService.recordAppView(appId, userId);
            }

            // Try to fetch current agent state to get latest generated code
            let generatedCode: GeneratedCodeFile[] = [];
            
            try {
                const agentStub = await getAgentStub(env, appResult.id);
                const agentProgress = await agentStub.getProgress();
                
                if (agentProgress && agentProgress.generatedCode && agentProgress.generatedCode.length > 0) {
                    // Convert agent progress format to expected frontend format
                    generatedCode = agentProgress.generatedCode.map((file: { filePath: string; fileContents: string; explanation?: string }) => ({
                        filePath: file.filePath,
                        fileContents: file.fileContents,
                        explanation: file.explanation
                    }));
                }
            } catch (agentError) {
                // If agent doesn't exist or error occurred, fall back to database stored files
                this.logger.warn('Could not fetch agent state, using stored files:', agentError);
            }

            const responseData: AppDetailsData = {
                ...appResult, // Spread all EnhancedAppData fields including stats
                cloudflareUrl: appResult.deploymentUrl,
                previewUrl: appResult.deploymentUrl,
                user: {
                    id: appResult.userId!,
                    displayName: appResult.userName || 'Unknown',
                    avatarUrl: appResult.userAvatar
                },
                generatedCode
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching app details:', error);
            return this.createErrorResponse<AppDetailsData>('Internal server error', 500);
        }
    }

    // Star/unstar an app
    async toggleAppStar(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<ControllerResponse<ApiResponse<AppStarToggleData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<AppStarToggleData>>;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse<AppStarToggleData>('App ID is required', 400);
            }

            const dbService = this.createDbService(env);

            // Check if app exists and toggle star using app service
            const appService = new AppService(dbService);
            const app = await appService.getSingleAppWithFavoriteStatus(appId, authResult.user!.id);
            if (!app) {
                return this.createErrorResponse<AppStarToggleData>('App not found', 404);
            }

            // Toggle star using app service
            const result = await appService.toggleAppStar(authResult.user!.id, appId);
            
            const responseData: AppStarToggleData = result;
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error toggling star:', error);
            return this.createErrorResponse<AppStarToggleData>('Internal server error', 500);
        }
    }

    // Fork an app
    async forkApp(request: Request, env: Env, _ctx: ExecutionContext, params?: Record<string, string>): Promise<ControllerResponse<ApiResponse<ForkAppData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<ForkAppData>>;
            }

            const appId = params?.id;
            if (!appId) {
                return this.createErrorResponse<ForkAppData>('App ID is required', 400);
            }

            const dbService = this.createDbService(env);

            // Get original app with permission checks using app service
            const appService = new AppService(dbService);
            const { app: originalApp, canFork } = await appService.getAppForFork(appId, authResult.user!.id);

            if (!originalApp) {
                return this.createErrorResponse<ForkAppData>('App not found', 404);
            }

            if (!canFork) {
                return this.createErrorResponse<ForkAppData>('App not found', 404);
            }

            // Duplicate agent state first
            try {
                const { newAgentId } = await cloneAgent(env, appId);
                this.logger.info(`Successfully duplicated agent state from ${appId} to ${newAgentId}`);

                // Create forked app using app service
                const forkedApp = await appService.createForkedApp(originalApp, newAgentId, authResult.user!.id);
                
                const responseData: ForkAppData = {
                    forkedAppId: forkedApp.id,
                    message: 'App forked successfully'
                };

                return this.createSuccessResponse(responseData);
            } catch (error) {
                this.logger.error('Failed to duplicate agent state:', error);
                return this.createErrorResponse<ForkAppData>('Failed to duplicate agent state', 500);
            }
        } catch (error) {
            this.logger.error('Error forking app:', error);
            return this.createErrorResponse<ForkAppData>('Internal server error', 500);
        }
    }
}

// Export singleton instance
export const appViewController = new AppViewController();