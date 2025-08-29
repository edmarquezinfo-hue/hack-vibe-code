/**
 * Consolidated GitHub Service
 * Handles all GitHub operations including repository creation, token management,
 * and API interactions with proper separation of concerns
 */

import { createLogger } from '../../logger';
import {
    GitHubRepository,
    CreateRepositoryOptions,
    CreateRepositoryResult,
    GitHubTokenResult,
    GitHubServiceConfig,
    GitHubServiceError
} from './types';

export class GitHubService {
    private logger = createLogger('GitHubService');

    constructor(private env: Env) {}

    /**
     * Get GitHub service configuration from environment
     */
    private getConfig(): GitHubServiceConfig {
        if (!this.env.GITHUB_APP_ID || !this.env.GITHUB_APP_PRIVATE_KEY) {
            throw new GitHubServiceError(
                'GitHub App not configured',
                'GITHUB_APP_NOT_CONFIGURED'
            );
        }

        return {
            appId: this.env.GITHUB_APP_ID,
            privateKey: this.env.GITHUB_APP_PRIVATE_KEY,
            clientId: this.env.GITHUB_APP_CLIENT_ID,
            clientSecret: this.env.GITHUB_APP_CLIENT_SECRET,
        };
    }

    /**
     * Generate authorization URL for user access token flow
     */
    generateUserAuthorizationUrl(state?: string, redirectUri?: string): string {
        const config = this.getConfig();
        const params = new URLSearchParams({
            client_id: config.clientId!,
            scope: 'public_repo repo', // GitHub Apps use permissions, but OAuth flow uses scopes
        });

        if (state) {
            params.set('state', state);
        }

        if (redirectUri) {
            params.set('redirect_uri', redirectUri);
        }

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }



    /**
     * Exchange authorization code for user access token
     */
    async exchangeCodeForUserToken(code: string, redirectUri?: string): Promise<GitHubTokenResult> {
        const config = this.getConfig();

        try {
            const response = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Cloudflare-OrangeBuild/1.0',
                },
                body: JSON.stringify({
                    client_id: config.clientId,
                    client_secret: config.clientSecret,
                    code: code,
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error('User access token exchange failed', {
                    status: response.status,
                    statusText: response.statusText,
                    error: error,
                });
                return { success: false, error: 'Failed to exchange code for user access token' };
            }

            const tokenData = await response.json() as {
                access_token?: string;
                error?: string;
                error_description?: string;
            };
            
            if (tokenData.error) {
                this.logger.error('OAuth error', tokenData);
                return { success: false, error: tokenData.error_description || tokenData.error };
            }

            return {
                success: true,
                token: tokenData.access_token!,
                // User access tokens don't typically have expires_at like installation tokens
            };
        } catch (error) {
            this.logger.error('Failed to exchange code for user access token', error);
            return { success: false, error: 'Token exchange failed' };
        }
    }

    /**
     * Create GitHub headers for API requests
     */
    private createHeaders(token: string, includeContentType = false): Record<string, string> {
        const headers: Record<string, string> = {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-OrangeBuild/1.0',
        };

        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }

        return headers;
    }
    /**
     * Create a new repository for user account
     */
    async createUserRepository(
        options: CreateRepositoryOptions,
        userAccessToken: string
    ): Promise<CreateRepositoryResult> {
        try {
            const response = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: this.createHeaders(userAccessToken, true),
                body: JSON.stringify({
                    name: options.name,
                    description: options.description,
                    private: options.private,
                    auto_init: options.auto_init || false,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error('Repository creation failed', {
                    status: response.status,
                    statusText: response.statusText,
                    error: error,
                    endpoint: 'https://api.github.com/user/repos'
                });
                
                // Provide helpful error message for permission issues
                if (response.status === 403) {
                    return {
                        success: false,
                        error: `GitHub App lacks required permissions. Please ensure the app has 'Contents: Write' and 'Metadata: Read' permissions, then re-install it.`
                    };
                }
                
                return {
                    success: false,
                    error: `Failed to create repository: ${error}`
                };
            }

            const repository = (await response.json()) as GitHubRepository;
            this.logger.info(`Successfully created repository: ${repository.html_url}`);

            return {
                success: true,
                repository
            };
        } catch (error) {
            this.logger.error('Failed to create user repository', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

}