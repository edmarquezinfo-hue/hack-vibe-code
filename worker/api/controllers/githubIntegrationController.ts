/**
 * GitHub Integration Controller
 * Handles GitHub integration status and management
 */

import { BaseController } from './BaseController';
import { githubIntegrations } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { OAuthIntegrationService } from '../../services/auth/OAuthIntegrationService';
import { isValidGitHubToken, validateGitHubScopes } from '../../utils/authUtils';

export class GitHubIntegrationController extends BaseController {
    
    private static instance = new GitHubIntegrationController();
    
    /**
     * Get GitHub integration status for the current user
     */
    static async getIntegrationStatus(request: Request, env: Env): Promise<Response> {
        return GitHubIntegrationController.instance.handleGetIntegrationStatus(request, env);
    }
    
    private async handleGetIntegrationStatus(request: Request, env: Env): Promise<Response> {
        try {
            // Get user from session
            const session = await this.getSessionFromRequest(request, env);
            
            if (!session) {
                return this.createErrorResponse('Authentication required', 401);
            }

            // Check if user has GitHub integration
            const dbService = this.createDbService(env);
            const integration = await dbService.db
                .select()
                .from(githubIntegrations)
                .where(eq(githubIntegrations.userId, session.userId))
                .limit(1);

            const hasIntegration = integration.length > 0 && integration[0].isActive;

            return this.createSuccessResponse({
                hasIntegration,
                githubUsername: hasIntegration ? integration[0].githubUsername : null,
                scopes: hasIntegration ? (integration[0].scopes as string[] || []) : [],
                lastValidated: hasIntegration ? integration[0].lastValidated : null
            });

        } catch (error) {
            return this.handleError(error, 'get GitHub integration status');
        }
    }

    /**
     * Store GitHub integration for a user after OAuth
     */
    static async storeIntegration(
        userId: string,
        githubData: {
            githubUserId: string;
            githubUsername: string;
            accessToken: string;
            refreshToken?: string;
            scopes: string[];
        },
        env: Env
    ): Promise<void> {
        return GitHubIntegrationController.instance.handleStoreIntegration(userId, githubData, env);
    }

    private async handleStoreIntegration(
        userId: string,
        githubData: {
            githubUserId: string;
            githubUsername: string;
            accessToken: string;
            refreshToken?: string;
            scopes: string[];
        },
        env: Env
    ): Promise<void> {
        try {
            // Input validation
            if (!userId?.trim()) {
                throw new Error('User ID is required');
            }
            
            // Validate GitHub user ID format (must be numeric)
            if (!/^\d+$/.test(githubData.githubUserId)) {
                throw new Error('Invalid GitHub user ID format');
            }
            
            // Sanitize GitHub username (remove potentially dangerous characters)
            const sanitizedUsername = githubData.githubUsername
                .replace(/[<>"'&]/g, '')
                .trim();
            
            if (!sanitizedUsername || sanitizedUsername.length > 39) { // GitHub max username length
                throw new Error('Invalid GitHub username');
            }
            
            // Validate access token using consolidated utility
            if (!isValidGitHubToken(githubData.accessToken)) {
                throw new Error('Invalid GitHub access token format');
            }
            
            // Validate scopes using consolidated utility
            const validatedScopes = validateGitHubScopes(githubData.scopes);
            if (validatedScopes.length !== githubData.scopes.length) {
                const invalidScopes = githubData.scopes.filter(scope => !validatedScopes.includes(scope as any));
                throw new Error(`Invalid OAuth scopes: ${invalidScopes.join(', ')}`);
            }

            const dbService = this.createDbService(env);
            
            // Store tokens directly - Cloudflare D1 provides encryption at rest
            // This is the standard industry practice for OAuth tokens

            // Upsert GitHub integration
            const existing = await dbService.db
                .select()
                .from(githubIntegrations)
                .where(eq(githubIntegrations.userId, userId))
                .limit(1);

            if (existing.length > 0) {
                // Update existing integration
                await dbService.db
                    .update(githubIntegrations)
                    .set({
                        githubUserId: githubData.githubUserId,
                        githubUsername: sanitizedUsername,
                        accessTokenHash: githubData.accessToken,
                        refreshTokenHash: githubData.refreshToken,
                        scopes: JSON.stringify(githubData.scopes),
                        isActive: true,
                        lastValidated: new Date(),
                        updatedAt: new Date()
                    })
                    .where(eq(githubIntegrations.userId, userId));
            } else {
                // Create new integration
                await dbService.db
                    .insert(githubIntegrations)
                    .values({
                        id: crypto.randomUUID(),
                        userId,
                        githubUserId: githubData.githubUserId,
                        githubUsername: sanitizedUsername,
                        accessTokenHash: githubData.accessToken,
                        refreshTokenHash: githubData.refreshToken,
                        scopes: JSON.stringify(githubData.scopes),
                        isActive: true,
                        lastValidated: new Date(),
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
            }

            this.logger.info('GitHub integration stored successfully', {
                userId,
                githubUsername: githubData.githubUsername,
                scopes: githubData.scopes
            });

        } catch (error) {
            this.logger.error('Error storing GitHub integration', error);
            throw error;
        }
    }

    /**
     * Initiate GitHub integration for authenticated user
     */
    static async initiateIntegration(request: Request, env: Env): Promise<Response> {
        return GitHubIntegrationController.instance.handleInitiateIntegration(request, env);
    }
    
    private async handleInitiateIntegration(request: Request, env: Env): Promise<Response> {
        try {
            // Check if user is authenticated
            const session = await this.getSessionFromRequest(request, env);
            
            if (!session) {
                return this.createErrorResponse('Authentication required', 401);
            }

            // Use OAuth integration service to generate auth URL
            const oauthService = new OAuthIntegrationService(env);
            const state = oauthService.createIntegrationState(session.userId);
            const authUrl = oauthService.generateAuthUrl(request, 'github', state);

            return Response.redirect(authUrl, 302);

        } catch (error) {
            return this.handleError(error, 'initiate GitHub integration');
        }
    }

    /**
     * Remove GitHub integration for a user
     */
    static async removeIntegration(request: Request, env: Env): Promise<Response> {
        return GitHubIntegrationController.instance.handleRemoveIntegration(request, env);
    }
    
    private async handleRemoveIntegration(request: Request, env: Env): Promise<Response> {
        try {
            // Get user from session
            const session = await this.getSessionFromRequest(request, env);
            
            if (!session) {
                return this.createErrorResponse('Authentication required', 401);
            }

            // Remove GitHub integration
            const dbService = this.createDbService(env);
            await dbService.db
                .update(githubIntegrations)
                .set({
                    isActive: false,
                    updatedAt: new Date()
                })
                .where(eq(githubIntegrations.userId, session.userId));

            this.logger.info('GitHub integration removed', { userId: session.userId });

            return this.createSuccessResponse({
                message: 'GitHub integration removed successfully'
            });

        } catch (error) {
            return this.handleError(error, 'remove GitHub integration');
        }
    }

    // Helper methods inherited from BaseController
}