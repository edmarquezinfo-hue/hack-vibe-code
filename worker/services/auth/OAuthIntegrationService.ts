/**
 * OAuth Integration Service
 * Consolidates OAuth logic for both login and integration flows
 */

import { createLogger } from '../../logger';

interface GitHubTokenResponse {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
}

interface GitHubUserResponse {
    id: number;
    login: string;
    email?: string;
    name?: string;
}

export interface OAuthIntegrationData {
    githubUserId: string;
    githubUsername: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
}

/**
 * Centralized OAuth integration service for GitHub and other providers
 */
export class OAuthIntegrationService {
    private logger = createLogger('OAuthIntegrationService');

    constructor(private env: Env) {}

    /**
     * Exchange OAuth code for access token
     */
    async exchangeCodeForToken(code: string, provider: 'github'): Promise<GitHubTokenResponse> {
        const endpoints = {
            github: 'https://github.com/login/oauth/access_token'
        };

        const credentials = {
            github: {
                client_id: this.env.GITHUB_CLIENT_ID,
                client_secret: this.env.GITHUB_CLIENT_SECRET
            }
        };

        const response = await fetch(endpoints[provider], {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                ...credentials[provider],
                code,
            }).toString(),
        });

        if (!response.ok) {
            this.logger.error('Failed to exchange code for token', { 
                provider, 
                status: response.status 
            });
            throw new Error(`Failed to exchange code for token: ${response.status}`);
        }

        const tokenData = await response.json() as GitHubTokenResponse;
        
        if (!tokenData.access_token) {
            this.logger.error('No access token received from provider', { provider });
            throw new Error('No access token received from OAuth provider');
        }

        return tokenData;
    }

    /**
     * Fetch user information from OAuth provider
     */
    async fetchUserInfo(accessToken: string, provider: 'github'): Promise<GitHubUserResponse> {
        const endpoints = {
            github: 'https://api.github.com/user'
        };

        const headers = {
            github: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github.v3+json',
            }
        };

        const response = await fetch(endpoints[provider], {
            headers: headers[provider],
        });

        if (!response.ok) {
            this.logger.error('Failed to fetch user info from provider', { 
                provider, 
                status: response.status 
            });
            throw new Error(`Failed to fetch user info: ${response.status}`);
        }

        const userData = await response.json() as GitHubUserResponse;
        
        if (!userData.id || !userData.login) {
            this.logger.error('Invalid user data received from provider', { 
                provider, 
                userData 
            });
            throw new Error('Invalid user data received from OAuth provider');
        }

        return userData;
    }

    /**
     * Process OAuth integration data
     */
    async processIntegration(code: string, provider: 'github'): Promise<OAuthIntegrationData> {
        try {
            // Exchange code for token
            const tokenData = await this.exchangeCodeForToken(code, provider);
            
            // Fetch user information
            const userData = await this.fetchUserInfo(tokenData.access_token!, provider);
            
            // Process scopes
            const scopes = tokenData.scope ? 
                tokenData.scope.split(',').map(s => s.trim()) : 
                ['repo', 'user:email', 'read:user'];

            return {
                githubUserId: userData.id.toString(),
                githubUsername: userData.login,
                accessToken: tokenData.access_token!,
                refreshToken: tokenData.refresh_token,
                scopes
            };

        } catch (error) {
            this.logger.error('Error processing OAuth integration', { 
                provider, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            throw error;
        }
    }

    /**
     * Generate OAuth authorization URL
     */
    generateAuthUrl(request: Request, provider: 'github', state: string, scopes?: string[]): string {
        const baseUrl = new URL(request.url).origin;
        
        const config = {
            github: {
                endpoint: 'https://github.com/login/oauth/authorize',
                clientId: this.env.GITHUB_CLIENT_ID,
                redirectUri: `${baseUrl}/api/auth/callback/github`,
                defaultScopes: ['repo', 'user:email', 'read:user']
            }
        };

        const providerConfig = config[provider];
        const scopeList = scopes || providerConfig.defaultScopes;

        const params = new URLSearchParams({
            client_id: providerConfig.clientId,
            redirect_uri: providerConfig.redirectUri,
            scope: scopeList.join(' '),
            state: Buffer.from(state).toString('base64'),
            response_type: 'code'
        });

        return `${providerConfig.endpoint}?${params.toString()}`;
    }

    /**
     * Validate and parse OAuth state
     */
    parseOAuthState(state: string): { type?: string; userId?: string; timestamp?: number } | null {
        try {
            const decodedState = Buffer.from(state, 'base64').toString();
            return JSON.parse(decodedState);
        } catch (error) {
            this.logger.warn('Failed to parse OAuth state', { 
                error: error instanceof Error ? error.message : 'Unknown error' 
            });
            return null;
        }
    }

    /**
     * Create integration state for OAuth flow
     */
    createIntegrationState(userId: string): string {
        return JSON.stringify({
            type: 'integration',
            userId,
            timestamp: Date.now()
        });
    }

    /**
     * Create login state for OAuth flow
     */
    createLoginState(): string {
        return JSON.stringify({
            type: 'login',
            timestamp: Date.now()
        });
    }
}