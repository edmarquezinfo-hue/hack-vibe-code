/**
 * GitHub Integration Controller
 * Handles GitHub integration status and management
 */

import { BaseController } from '../BaseController';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { RouteContext } from '../../types/route-context';
import { OAuthIntegrationService } from '../../../services/auth/OAuthIntegrationService';
import { DatabaseService } from '../../../database/database';
import { createLogger } from '../../../logger';
import {
    GitHubIntegrationStatusData,
    GitHubIntegrationRemovalData,
    GitHubIntegrationInput
} from './types';

export class GitHubIntegrationController extends BaseController {
    constructor() {
        super();
    }
    
    /**
     * Get GitHub integration status for the current user
     */
    async getIntegrationStatus(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<GitHubIntegrationStatusData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<GitHubIntegrationStatusData>('Authentication required', 401);
            }

            // Get GitHub integration using database service
            const dbService = this.createDbService(env);
            const integration = await dbService.getGitHubIntegration(user.id);

            const hasIntegration = integration && integration.isActive;

            const responseData: GitHubIntegrationStatusData = {
                hasIntegration: !!hasIntegration,
                githubUsername: hasIntegration ? integration.githubUsername : null,
                scopes: hasIntegration ? (JSON.parse(integration.scopes as string) || []) : [],
                lastValidated: hasIntegration ? integration.lastValidated : null
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting GitHub integration status:', error);
            return this.createErrorResponse<GitHubIntegrationStatusData>('Failed to get integration status', 500);
        }
    }

    /**
     * Store GitHub integration for a user after OAuth
     * Static method for use by OAuth service
     */
    static async storeIntegration(
        userId: string,
        githubData: GitHubIntegrationInput,
        env: Env
    ): Promise<void> {
        try {
            const dbService = new DatabaseService({ DB: env.DB });
            await dbService.upsertGitHubIntegration(userId, githubData);

        } catch (error) {
            const logger = createLogger('GitHubIntegrationController');
            logger.error('Error storing GitHub integration', error);
            throw error;
        }
    }

    /**
     * Initiate GitHub integration for authenticated user
     */
    async initiateIntegration(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            // Check if user is authenticated
            const user = this.extractAuthUser(context);
            
            if (!user) {
                return this.createErrorResponse<never>('Authentication required', 401);
            }

            // Use OAuth integration service to generate auth URL
            const oauthService = new OAuthIntegrationService(env);
            const state = oauthService.createIntegrationState(user.id);
            const authUrl = oauthService.generateAuthUrl(request, 'github', state);

            return Response.redirect(authUrl, 302);

        } catch (error) {
            this.logger.error('Error initiating GitHub integration:', error);
            return this.createErrorResponse<never>('Failed to initiate GitHub integration', 500);
        }
    }

    /**
     * Remove GitHub integration for a user
     */
    async removeIntegration(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<GitHubIntegrationRemovalData>>> {
        try {
            // Get user from session
            const user = this.extractAuthUser(context);
            
            if (!user) {
                return this.createErrorResponse<GitHubIntegrationRemovalData>('Authentication required', 401);
            }

            // Remove GitHub integration using database service
            const dbService = this.createDbService(env);
            await dbService.deactivateGitHubIntegration(user.id);

            this.logger.info('GitHub integration removed', { userId: user.id });

            const responseData: GitHubIntegrationRemovalData = {
                message: 'GitHub integration removed successfully'
            };

            return this.createSuccessResponse(responseData);

        } catch (error) {
            this.logger.error('Error removing GitHub integration:', error);
            return this.createErrorResponse<GitHubIntegrationRemovalData>('Failed to remove GitHub integration', 500);
        }
    }
}