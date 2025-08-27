/**
 * Secure Authentication Controller
 * Handles all authentication endpoints with proper separation of concerns
 */

import { BaseController } from '../BaseController';
import { generateId } from '../../../utils/idGenerator';
import { AuthService } from '../../../services/auth/authService';
import { SessionService } from '../../../services/auth/sessionService';
import { TokenService } from '../../../services/auth/tokenService';
import { 
    loginSchema, 
    registerSchema, 
    refreshTokenSchema,
    oauthProviderSchema
} from '../../../services/auth/validators/authSchemas';
import { SecurityError } from '../../../types/security';
import { 
    setSecureAuthCookies, 
    clearAuthCookies, 
    extractRefreshToken,
    formatAuthResponse,
    mapUserResponse
} from '../../../utils/authUtils';
import { OAuthIntegrationService } from '../../../services/auth/OAuthIntegrationService';
import { UserService } from '../../../database/services/UserService';
import * as schema from '../../../database/schema';
import { eq, and, desc, ne } from 'drizzle-orm';
import { GitHubIntegrationController } from '../githubIntegration/controller';
import { RouteContext } from '../../types/route-context';
import { authMiddleware } from '../../../middleware/security/auth';

/**
 * Authentication Controller
 * All business logic for auth endpoints
 */
export class AuthController extends BaseController {
    private authService: AuthService;
    
    constructor(private env: Env, baseUrl: string) {
        super();
        const db = this.createDbService(env);
        this.authService = new AuthService(db, env, baseUrl);
    }
    
    
    /**
     * Register a new user
     * POST /api/auth/register
     */
    async register(request: Request, env: Env, _ctx: ExecutionContext, _routeContext: RouteContext): Promise<Response> {
        try {
            // Check if OAuth providers are configured - if yes, block email/password registration
            const hasOAuth = (!!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET) || 
                           (!!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET);
            
            if (hasOAuth) {
                return this.createErrorResponse(
                    'Email/password registration is not available when OAuth providers are configured. Please use OAuth login instead.',
                    403
                );
            }

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const validatedData = registerSchema.parse(bodyResult.data);
            
            const result = await this.authService.register(validatedData, request);
            
            const response = this.createSuccessResponse(
                formatAuthResponse(result.user, undefined, result.expiresIn)
            );
            
            setSecureAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                accessTokenExpiry: result.expiresIn
            });
            
            return response;
        } catch (error) {
            if (error instanceof SecurityError) {
                return this.createErrorResponse(error.message, error.statusCode);
            }
            
            return this.handleError(error, 'register user');
        }
    }
    
    /**
     * Login with email and password
     * POST /api/auth/login
     */
    async login(request: Request, env: Env, _ctx: ExecutionContext, _routeContext: RouteContext): Promise<Response> {
        try {
            // Check if OAuth providers are configured - if yes, block email/password login
            const hasOAuth = (!!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET) || 
                           (!!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET);
            
            if (hasOAuth) {
                return this.createErrorResponse(
                    'Email/password login is not available when OAuth providers are configured. Please use OAuth login instead.',
                    403
                );
            }

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const validatedData = loginSchema.parse(bodyResult.data);
            
            const result = await this.authService.login(validatedData, request);
            
            const response = this.createSuccessResponse(
                formatAuthResponse(result.user, undefined, result.expiresIn)
            );
            
            setSecureAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                accessTokenExpiry: result.expiresIn
            });
            
            return response;
        } catch (error) {
            if (error instanceof SecurityError) {
                return this.createErrorResponse(error.message, error.statusCode);
            }
            
            return this.handleError(error, 'login user');
        }
    }
    
    /**
     * Logout current user
     * POST /api/auth/logout
     */
    async logout(request: Request, _env: Env, _ctx: ExecutionContext, _routeContext: RouteContext): Promise<Response> {
        try {
            // Try to get refresh token to properly logout session
            const refreshToken = extractRefreshToken(request);
            
            if (refreshToken) {
                try {
                    const tokenService = new TokenService(this.env);
                    const tokenPayload = await tokenService.verifyToken(refreshToken);
                    if (tokenPayload && tokenPayload.type === 'refresh') {
                        // Find and delete the session
                        const refreshTokenHash = await tokenService.hashToken(refreshToken);
                        const db = this.createDbService(this.env);
                        await db.db
                            .update(schema.sessions)
                            .set({
                                isRevoked: true,
                                revokedAt: new Date(),
                                revokedReason: 'user_logout'
                            })
                            .where(eq(schema.sessions.refreshTokenHash, refreshTokenHash));
                    }
                } catch (error) {
                    this.logger.debug('Failed to properly logout session', error);
                }
            }
            
            const response = this.createSuccessResponse({ 
                success: true, 
                message: 'Logged out successfully' 
            });
            
            clearAuthCookies(response);
            
            return response;
        } catch (error) {
            this.logger.error('Logout failed', error);
            
            const response = this.createSuccessResponse({ 
                success: true, 
                message: 'Logged out' 
            });
            
            clearAuthCookies(response);
            
            return response;
        }
    }
    
    /**
     * Get current user profile
     * GET /api/auth/profile
     */
    async getProfile(_request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            // User is provided by middleware - no need for manual authentication
            const user = routeContext.user;
            if (!user) {
                return this.createErrorResponse('Unauthorized', 401);
            }
            
            const db = this.createDbService(this.env);
            const userService = new UserService(db);
            const fullUser = await userService.findUserById(user.id);
            
            if (!fullUser) {
                return this.createErrorResponse('User not found', 404);
            }
            
            return this.createSuccessResponse({
                user: mapUserResponse(fullUser),
                sessionId: user.id // Use user ID as session identifier
            });
        } catch (error) {
            return this.handleError(error, 'get profile');
        }
    }
    
    /**
     * Update user profile
     * PUT /api/auth/profile
     */
    async updateProfile(request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const user = routeContext.user;
            if (!user) {
                return this.createErrorResponse('Unauthorized', 401);
            }
            
            const bodyResult = await this.parseJsonBody<{
                displayName?: string;
                username?: string;
                bio?: string;
                theme?: 'light' | 'dark' | 'system';
                timezone?: string;
            }>(request);
            
            if (!bodyResult.success) {
                return bodyResult.response!;
            }
            
            const updateData = bodyResult.data!;
            
            // Validate username uniqueness if provided
            if (updateData.username) {
                const db = this.createDbService(this.env);
                const existingUser = await db.db
                    .select({ id: schema.users.id })
                    .from(schema.users)
                    .where(
                        and(
                            eq(schema.users.username, updateData.username),
                            ne(schema.users.id, user.id)
                        )
                    )
                    .get();
                
                if (existingUser) {
                    return this.createErrorResponse('Username already taken', 400);
                }
            }
            
            // Update user profile
            const db = this.createDbService(this.env);
            await db.db
                .update(schema.users)
                .set({
                    displayName: updateData.displayName,
                    username: updateData.username,
                    bio: updateData.bio,
                    theme: updateData.theme,
                    timezone: updateData.timezone,
                    updatedAt: new Date()
                })
                .where(eq(schema.users.id, user.id));
            
            // Return updated user data
            const userService = new UserService(db);
            const updatedUser = await userService.findUserById(user.id);
            
            if (!updatedUser) {
                return this.createErrorResponse('User not found', 404);
            }
            
            return this.createSuccessResponse({
                user: mapUserResponse(updatedUser),
                message: 'Profile updated successfully'
            });
        } catch (error) {
            return this.handleError(error, 'update profile');
        }
    }
    
    /**
     * Initiate OAuth flow
     * GET /api/auth/oauth/:provider
     */
    async initiateOAuth(request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const validatedProvider = oauthProviderSchema.parse(routeContext.pathParams.provider);
            
            // Get intended redirect URL from query parameter
            const intendedRedirectUrl = routeContext.queryParams.get('redirect_url') || undefined;
            
            const authUrl = await this.authService.getOAuthAuthorizationUrl(
                validatedProvider,
                request,
                intendedRedirectUrl
            );
            
            return Response.redirect(authUrl, 302);
        } catch (error) {
            this.logger.error('OAuth initiation failed', error);
            
            if (error instanceof SecurityError) {
                return this.createErrorResponse(error.message, error.statusCode);
            }
            
            return this.handleError(error, 'initiate OAuth');
        }
    }
    
    /**
     * Handle OAuth callback
     * GET /api/auth/callback/:provider
     */
    async handleOAuthCallback(request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const validatedProvider = oauthProviderSchema.parse(routeContext.pathParams.provider);
            
            const code = routeContext.queryParams.get('code');
            const state = routeContext.queryParams.get('state');
            const error = routeContext.queryParams.get('error');
            
            if (error) {
                this.logger.error('OAuth provider returned error', { provider: validatedProvider, error });
                const baseUrl = new URL(request.url).origin;
                return Response.redirect(`${baseUrl}/?error=oauth_failed`, 302);
            }
            
            if (!code || !state) {
                const baseUrl = new URL(request.url).origin;
                return Response.redirect(`${baseUrl}/?error=missing_params`, 302);
            }

            // Check if this is an integration flow using OAuth service
            const oauthService = new OAuthIntegrationService(this.env);
            const stateData = oauthService.parseOAuthState(state);
            const isIntegrationFlow = stateData?.type === 'integration' && stateData.userId;

            if (isIntegrationFlow && validatedProvider === 'github') {
                // Handle GitHub integration for existing user
                return await this.handleGitHubIntegration(code, stateData!.userId!, request);
            }
            
            const result = await this.authService.handleOAuthCallback(
                validatedProvider,
                code,
                state,
                request
            );
            
            const baseUrl = new URL(request.url).origin;
            
            // Use stored redirect URL or default to home page
            const redirectLocation = result.redirectUrl || `${baseUrl}/`;
            
            // Create redirect response with secure auth cookies
            const response = new Response(null, {
                status: 302,
                headers: {
                    'Location': redirectLocation
                }
            });
            
            this.logger.info('DEBUG: Setting auth cookies', {
                hasAccessToken: !!result.accessToken,
                hasRefreshToken: !!result.refreshToken,
                accessTokenLength: result.accessToken ? result.accessToken.length : 0,
                refreshTokenLength: result.refreshToken ? result.refreshToken.length : 0,
                redirectLocation
            });
            
            setSecureAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            });
            
            // Log the actual Set-Cookie headers
            const setCookieHeaders = response.headers.getSetCookie();
            this.logger.info('DEBUG: Set-Cookie headers created', {
                cookieCount: setCookieHeaders.length,
                cookies: setCookieHeaders.map(cookie => cookie.substring(0, 50) + '...')
            });
            
            return response;
        } catch (error) {
            this.logger.error('OAuth callback failed', error);
            const baseUrl = new URL(request.url).origin;
            return Response.redirect(`${baseUrl}/?error=auth_failed`, 302);
        }
    }

    /**
     * Handle GitHub integration for existing authenticated user
     */
    private async handleGitHubIntegration(code: string, userId: string, request: Request): Promise<Response> {
        try {
            const baseUrl = new URL(request.url).origin;

            // Use OAuth integration service to process the integration
            const oauthService = new OAuthIntegrationService(this.env);
            const integrationData = await oauthService.processIntegration(code, 'github');

            // Store the integration using GitHubIntegrationController
            await GitHubIntegrationController.storeIntegration(userId, integrationData, this.env);

            this.logger.info('GitHub integration completed', { 
                userId, 
                githubUsername: integrationData.githubUsername 
            });

            // Redirect to settings with success message
            return Response.redirect(`${baseUrl}/settings?integration=github&status=success`, 302);

        } catch (error) {
            this.logger.error('GitHub integration failed', error);
            const baseUrl = new URL(request.url).origin;
            return Response.redirect(`${baseUrl}/settings?integration=github&status=error`, 302);
        }
    }
    
    /**
     * Refresh access token
     * POST /api/auth/refresh
     */
    async refreshToken(request: Request, _env: Env, _ctx: ExecutionContext, _routeContext: RouteContext): Promise<Response> {
        try {
            let refreshToken: string | undefined;
            
            // Try body first
            const bodyResult = await this.parseJsonBody<{ refreshToken?: string }>(request);
            if (bodyResult.success && bodyResult.data?.refreshToken) {
                refreshToken = bodyResult.data.refreshToken;
            }
            
            // Try cookies if not in body (using consolidated utility)
            if (!refreshToken) {
                refreshToken = extractRefreshToken(request) || undefined;
            }
            
            if (!refreshToken) {
                return this.createErrorResponse('Refresh token required', 400);
            }
            
            const validatedData = refreshTokenSchema.parse({ refreshToken });
            const result = await this.authService.refreshToken(validatedData.refreshToken);
            
            const response = this.createSuccessResponse({
                accessToken: result.accessToken,
                expiresIn: result.expiresIn
            });
            
            response.headers.append(
                'Set-Cookie',
                `accessToken=${result.accessToken}; Path=/; Max-Age=${result.expiresIn}; HttpOnly; Secure; SameSite=Lax`
            );
            
            return response;
        } catch (error) {
            if (error instanceof SecurityError) {
                return this.createErrorResponse(error.message, error.statusCode);
            }
            
            return this.handleError(error, 'refresh token');
        }
    }
    
    /**
     * Check authentication status
     * GET /api/auth/check
     */
    async checkAuth(request: Request, _env: Env, _ctx: ExecutionContext, _routeContext: RouteContext): Promise<Response> {
        try {
            // Use the same middleware authentication logic but don't require auth
            const user = await authMiddleware(request, this.env);
            
            if (!user) {
                return this.createSuccessResponse({
                    authenticated: false,
                    user: null
                });
            }
            
            return this.createSuccessResponse({
                authenticated: true,
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName
                },
                sessionId: user.id
            });
        } catch (error) {
            return this.createSuccessResponse({
                authenticated: false,
                user: null
            });
        }
    }

    /**
     * Get active sessions for current user
     * GET /api/auth/sessions
     */
    async getActiveSessions(_request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const user = routeContext.user;
            if (!user) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const db = this.createDbService(this.env);
            const sessionService = new SessionService(db, new TokenService(this.env));
            const sessions = await sessionService.getUserSessions(user.id);

            return this.createSuccessResponse({
                sessions: sessions
            });
        } catch (error) {
            return this.handleError(error, 'get active sessions');
        }
    }

    /**
     * Revoke a specific session
     * DELETE /api/auth/sessions/:sessionId
     */
    async revokeSession(_request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const user = routeContext.user;
            if (!user) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            // Extract session ID from URL
            const sessionIdToRevoke = routeContext.pathParams.sessionId;

            const db = this.createDbService(this.env);
            const sessionService = new SessionService(db, new TokenService(this.env));
            
            await sessionService.revokeSession(sessionIdToRevoke);

            return this.createSuccessResponse({
                message: 'Session revoked successfully'
            });
        } catch (error) {
            return this.handleError(error, 'revoke session');
        }
    }

    /**
     * Get API keys for current user
     * GET /api/auth/api-keys
     */
    async getApiKeys(_request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const user = routeContext.user;
            if (!user) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const db = this.createDbService(this.env);
            const keys = await db.db
                .select({
                    id: schema.apiKeys.id,
                    name: schema.apiKeys.name,
                    keyPreview: schema.apiKeys.keyPreview,
                    createdAt: schema.apiKeys.createdAt,
                    lastUsed: schema.apiKeys.lastUsed,
                    isActive: schema.apiKeys.isActive
                })
                .from(schema.apiKeys)
                .where(eq(schema.apiKeys.userId, user.id))
                .orderBy(desc(schema.apiKeys.createdAt))
                .all();

            return this.createSuccessResponse({
                keys: keys.map((key: { id: string; name: string; keyPreview: string; createdAt: Date | null; lastUsed: Date | null; isActive: boolean | null }) => ({
                    id: key.id,
                    name: key.name,
                    keyPreview: key.keyPreview,
                    createdAt: key.createdAt,
                    lastUsed: key.lastUsed,
                    isActive: !!key.isActive
                }))
            });
        } catch (error) {
            return this.handleError(error, 'get API keys');
        }
    }

    /**
     * Create a new API key
     * POST /api/auth/api-keys
     */
    async createApiKey(request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const user = routeContext.user;
            if (!user) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const bodyResult = await this.parseJsonBody<{ name?: string }>(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const { name } = bodyResult.data!;

            if (!name || typeof name !== 'string' || name.trim().length === 0) {
                return this.createErrorResponse('API key name is required', 400);
            }

            // Sanitize name
            const sanitizedName = name.trim().substring(0, 100);

            const tokenService = new TokenService(this.env);
            const { key, keyHash, keyPreview } = await tokenService.generateApiKey();

            const db = this.createDbService(this.env);
            
            // Create API key record
            await db.db
                .insert(schema.apiKeys)
                .values({
                    id: generateId(),
                    userId: user.id,
                    name: sanitizedName,
                    keyHash,
                    keyPreview,
                    scopes: JSON.stringify(['read', 'write']), // Default scopes
                    isActive: true,
                    requestCount: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

            this.logger.info('API key created', { userId: user.id, name: sanitizedName });

            return this.createSuccessResponse({
                key, // Return the actual key only once
                keyPreview,
                name: sanitizedName,
                message: 'API key created successfully'
            });
        } catch (error) {
            return this.handleError(error, 'create API key');
        }
    }

    /**
     * Revoke an API key
     * DELETE /api/auth/api-keys/:keyId
     */
    async revokeApiKey(_request: Request, _env: Env, _ctx: ExecutionContext, routeContext: RouteContext): Promise<Response> {
        try {
            const user = routeContext.user;
            if (!user) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            // Extract key ID from URL
            const keyId = routeContext.pathParams.keyId;

            const db = this.createDbService(this.env);
            
            // Verify key belongs to user and delete it
            await db.db
                .update(schema.apiKeys)
                .set({
                    isActive: false,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(schema.apiKeys.id, keyId),
                        eq(schema.apiKeys.userId, user.id)
                    )
                );

            this.logger.info('API key revoked', { userId: user.id, keyId });

            return this.createSuccessResponse({
                message: 'API key revoked successfully'
            });
        } catch (error) {
            return this.handleError(error, 'revoke API key');
        }
    }

    /**
     * Verify email with OTP
     * POST /api/auth/verify-email
     */
    async verifyEmail(request: Request, _env: Env, _ctx: ExecutionContext, _routeContext: RouteContext): Promise<Response> {
        try {
            const bodyResult = await this.parseJsonBody<{ email: string; otp: string }>(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const { email, otp } = bodyResult.data!;

            if (!email || !otp) {
                return this.createErrorResponse('Email and OTP are required', 400);
            }

            const result = await this.authService.verifyEmailWithOtp(email, otp, request);
            
            const response = this.createSuccessResponse(
                formatAuthResponse(result.user, undefined, result.expiresIn)
            );
            
            setSecureAuthCookies(response, {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                accessTokenExpiry: result.expiresIn
            });
            
            return response;
        } catch (error) {
            if (error instanceof SecurityError) {
                return this.createErrorResponse(error.message, error.statusCode);
            }
            
            return this.handleError(error, 'verify email');
        }
    }

    /**
     * Resend verification OTP
     * POST /api/auth/resend-verification
     */
    async resendVerificationOtp(request: Request, _env: Env, _ctx: ExecutionContext, _routeContext: RouteContext): Promise<Response> {
        try {
            const bodyResult = await this.parseJsonBody<{ email: string }>(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const { email } = bodyResult.data!;

            if (!email) {
                return this.createErrorResponse('Email is required', 400);
            }

            await this.authService.resendVerificationOtp(email);
            
            return this.createSuccessResponse({
                message: 'Verification code sent successfully'
            });
        } catch (error) {
            if (error instanceof SecurityError) {
                return this.createErrorResponse(error.message, error.statusCode);
            }
            
            return this.handleError(error, 'resend verification OTP');
        }
    }

    /**
     * Get available authentication providers
     * GET /api/auth/providers
     */
    async getAuthProviders(
        _request: Request,
        env: Env,
        _ctx: ExecutionContext,
        _routeContext?: RouteContext
    ) {
        try {
            const providers = {
                google: !!env.GOOGLE_CLIENT_ID && !!env.GOOGLE_CLIENT_SECRET,
                github: !!env.GITHUB_CLIENT_ID && !!env.GITHUB_CLIENT_SECRET,
                email: true // Email/password is always available
            };

            return this.createSuccessResponse({
                providers,
                hasOAuth: providers.google || providers.github,
                requiresEmailAuth: !providers.google && !providers.github
            });
        } catch (error) {
            console.error('Get auth providers error:', error);
            return this.createErrorResponse('Failed to get authentication providers', 500);
        }
    }
    
    // Helper methods moved to BaseController
    // Token extraction, cookie management, and parsing utilities moved to utils/authUtils.ts
}
