/**
 * Main Authentication Service
 * Orchestrates all auth operations including login, registration, and OAuth
 */

import { DatabaseService } from '../../database/database';
import * as schema from '../../database/schema';
import { eq, and, sql, or, lt } from 'drizzle-orm';
import { TokenService } from './tokenService';
import { SessionService } from './sessionService';
import { PasswordService } from './passwordService';
import { GoogleOAuthProvider } from './providers/google';
import { GitHubOAuthProvider } from './providers/github';
import { BaseOAuthProvider, OAuthUserInfo } from './providers/base';
import { 
    SecurityError, 
    SecurityErrorType 
} from '../../types/security';
import {
    AuthUser, 
    OAuthProvider
} from '../../types/auth-types';
import { mapUserResponse } from '../../utils/authUtils';
import { createLogger } from '../../logger';
import { validateEmail, validatePassword } from '../../utils/validationUtils';
import { extractRequestMetadata } from '../../utils/authUtils';

const logger = createLogger('AuthService');

/**
 * Login credentials
 */
export interface LoginCredentials {
    email: string;
    password: string;
}

/**
 * Registration data
 */
export interface RegistrationData {
    email: string;
    password: string;
    name?: string;
}

/**
 * Auth result
 */
export interface AuthResult {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * Main Authentication Service
 */
export class AuthService {
    private readonly tokenService: TokenService;
    private readonly sessionService: SessionService;
    private readonly passwordService: PasswordService;
    private readonly oauthProviders: Map<OAuthProvider, BaseOAuthProvider>;
    
    constructor(
        private db: DatabaseService,
        private env: Env,
        baseUrl: string
    ) {
        this.tokenService = new TokenService(env);
        this.sessionService = new SessionService(db, this.tokenService);
        this.passwordService = new PasswordService();
        
        // Initialize OAuth providers
        this.oauthProviders = new Map();
        
        try {
            this.oauthProviders.set('google', GoogleOAuthProvider.create(env, baseUrl));
        } catch {
            logger.warn('Google OAuth provider not configured');
        }
        
        try {
            this.oauthProviders.set('github', GitHubOAuthProvider.create(env, baseUrl));
        } catch {
            logger.warn('GitHub OAuth provider not configured');
        }
    }
    
    /**
     * Register a new user
     */
    async register(data: RegistrationData, request: Request): Promise<AuthResult> {
        try {
            // Validate email format using centralized utility
            const emailValidation = validateEmail(data.email);
            if (!emailValidation.valid) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    emailValidation.error || 'Invalid email format',
                    400
                );
            }
            
            // Validate password using centralized utility
            const passwordValidation = validatePassword(data.password, undefined, {
                email: data.email,
                name: data.name
            });
            if (!passwordValidation.valid) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    passwordValidation.errors!.join(', '),
                    400
                );
            }
            
            // Check if user already exists
            const existingUser = await this.db.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.email, data.email.toLowerCase()))
                .get();
            
            if (existingUser) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    'Email already registered',
                    400
                );
            }
            
            // Hash password
            const passwordHash = await this.passwordService.hash(data.password);
            
            // Create user
            const userId = crypto.randomUUID();
            const now = new Date();
            
            await this.db.db.insert(schema.users).values({
                id: userId,
                email: data.email.toLowerCase(),
                passwordHash,
                displayName: data.name || data.email.split('@')[0],
                emailVerified: false, // Email verification can be implemented later
                provider: 'email',
                providerId: userId,
                createdAt: now,
                updatedAt: now
            });
            
            // Create session
            const { accessToken, refreshToken } = await this.sessionService.createSession(
                userId,
                request
            );
            
            // Log auth attempt
            await this.logAuthAttempt(data.email, 'register', true, request);
            
            logger.info('User registered', { userId, email: data.email });
            
            // Fetch complete user data to return consistent response
            const newUser = await this.db.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, userId))
                .get();
            
            if (!newUser) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    'Failed to retrieve created user',
                    500
                );
            }
            
            return {
                user: mapUserResponse(newUser),
                accessToken,
                refreshToken,
                expiresIn: 24 * 3600 // 24 hours
            };
        } catch (error) {
            await this.logAuthAttempt(data.email, 'register', false, request);
            
            if (error instanceof SecurityError) {
                throw error;
            }
            
            logger.error('Registration error', error);
            throw new SecurityError(
                SecurityErrorType.INVALID_INPUT,
                'Registration failed',
                500
            );
        }
    }
    
    /**
     * Login with email and password
     */
    async login(credentials: LoginCredentials, request: Request): Promise<AuthResult> {
        try {
            // Find user
            const user = await this.db.db
                .select()
                .from(schema.users)
                .where(
                    and(
                        eq(schema.users.email, credentials.email.toLowerCase()),
                        sql`${schema.users.deletedAt} IS NULL`
                    )
                )
                .get();
            
            if (!user || !user.passwordHash) {
                await this.logAuthAttempt(credentials.email, 'login', false, request);
                throw new SecurityError(
                    SecurityErrorType.UNAUTHORIZED,
                    'Invalid email or password',
                    401
                );
            }
            
            // Verify password
            const passwordValid = await this.passwordService.verify(
                credentials.password,
                user.passwordHash
            );
            
            if (!passwordValid) {
                await this.logAuthAttempt(credentials.email, 'login', false, request);
                throw new SecurityError(
                    SecurityErrorType.UNAUTHORIZED,
                    'Invalid email or password',
                    401
                );
            }
            
            // Create session
            const { accessToken, refreshToken } = await this.sessionService.createSession(
                user.id,
                request
            );
            
            // Log successful attempt
            await this.logAuthAttempt(credentials.email, 'login', true, request);
            
            logger.info('User logged in', { userId: user.id, email: user.email });
            
            return {
                user: mapUserResponse(user),
                accessToken,
                refreshToken,
                expiresIn: 24 * 3600 // 24 hours
            };
        } catch (error) {
            if (error instanceof SecurityError) {
                throw error;
            }
            
            logger.error('Login error', error);
            throw new SecurityError(
                SecurityErrorType.UNAUTHORIZED,
                'Login failed',
                500
            );
        }
    }
    
    /**
     * Logout
     */
    async logout(sessionId: string): Promise<void> {
        try {
            await this.sessionService.revokeSession(sessionId);
            logger.info('User logged out', { sessionId });
        } catch (error) {
            logger.error('Logout error', error);
            throw new SecurityError(
                SecurityErrorType.UNAUTHORIZED,
                'Logout failed',
                500
            );
        }
    }
    
    /**
     * Get OAuth authorization URL
     */
    async getOAuthAuthorizationUrl(
        provider: OAuthProvider,
        _request: Request
    ): Promise<string> {
        const oauthProvider = this.oauthProviders.get(provider);
        if (!oauthProvider) {
            throw new SecurityError(
                SecurityErrorType.INVALID_INPUT,
                `OAuth provider ${provider} not configured`,
                400
            );
        }
        
        // Clean up expired OAuth states first
        await this.cleanupExpiredOAuthStates();
        
        // Generate state for CSRF protection
        const state = await this.tokenService.generateSecureToken();
        
        // Generate PKCE code verifier
        const codeVerifier = BaseOAuthProvider.generateCodeVerifier();
        
        // Store OAuth state
        await this.db.db.insert(schema.oauthStates).values({
            id: crypto.randomUUID(),
            state,
            provider,
            codeVerifier,
            redirectUri: oauthProvider['redirectUri'],
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 600000), // 10 minutes
            isUsed: false,
            scopes: [],
            userId: null,
            nonce: null
        });
        
        // Get authorization URL
        const authUrl = await oauthProvider.getAuthorizationUrl(state, codeVerifier);
        
        logger.info('OAuth authorization initiated', { provider });
        
        return authUrl;
    }
    
    /**
     * Clean up expired OAuth states
     */
    private async cleanupExpiredOAuthStates(): Promise<void> {
        try {
            const now = new Date();
            await this.db.db
                .delete(schema.oauthStates)
                .where(
                    or(
                        lt(schema.oauthStates.expiresAt, now),
                        eq(schema.oauthStates.isUsed, true)
                    )
                );
            
            logger.debug('Cleaned up expired OAuth states');
        } catch (error) {
            logger.error('Error cleaning up OAuth states', error);
        }
    }
    
    /**
     * Handle OAuth callback
     */
    async handleOAuthCallback(
        provider: OAuthProvider,
        code: string,
        state: string,
        request: Request
    ): Promise<AuthResult> {
        try {
            const oauthProvider = this.oauthProviders.get(provider);
            if (!oauthProvider) {
                throw new SecurityError(
                    SecurityErrorType.INVALID_INPUT,
                    `OAuth provider ${provider} not configured`,
                    400
                );
            }
            
            // Verify state
            const now = new Date();
            const oauthState = await this.db.db
                .select()
                .from(schema.oauthStates)
                .where(
                    and(
                        eq(schema.oauthStates.state, state),
                        eq(schema.oauthStates.provider, provider),
                        eq(schema.oauthStates.isUsed, false)
                    )
                )
                .get();
            
            if (!oauthState || new Date(oauthState.expiresAt) < now) {
                throw new SecurityError(
                    SecurityErrorType.CSRF_VIOLATION,
                    'Invalid or expired OAuth state',
                    400
                );
            }
            
            // Mark state as used
            await this.db.db
                .update(schema.oauthStates)
                .set({ isUsed: true })
                .where(eq(schema.oauthStates.id, oauthState.id));
            
            // Exchange code for tokens
            const tokens = await oauthProvider.exchangeCodeForTokens(
                code,
                oauthState.codeVerifier || undefined
            );
            
            // Get user info
            const oauthUserInfo = await oauthProvider.getUserInfo(tokens.accessToken);
            
            // Find or create user
            const user = await this.findOrCreateOAuthUser(provider, oauthUserInfo);
            
            // Store GitHub integration if this is GitHub OAuth
            if (provider === 'github') {
                try {
                    const { GitHubIntegrationController } = await import('../../api/controllers/githubIntegrationController');
                    await GitHubIntegrationController.storeIntegration(
                        user.id,
                        {
                            githubUserId: oauthUserInfo.id,
                            githubUsername: oauthUserInfo.name || oauthUserInfo.email.split('@')[0],
                            accessToken: tokens.accessToken,
                            refreshToken: tokens.refreshToken,
                            scopes: ['repo', 'user:email', 'read:user']
                        },
                        this.env
                    );
                } catch (error) {
                    logger.error('Failed to store GitHub integration', error);
                    // Don't fail the OAuth flow if GitHub integration storage fails
                }
            }
            
            // Create session
            const { accessToken: sessionAccessToken, refreshToken: sessionRefreshToken } = await this.sessionService.createSession(
                user.id,
                request
            );
            
            // Log auth attempt
            await this.logAuthAttempt(user.email, `oauth_${provider}`, true, request);
            
            logger.info('OAuth login successful', { userId: user.id, provider });
            
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName || undefined,
                    isAnonymous: false
                },
                accessToken: sessionAccessToken,
                refreshToken: sessionRefreshToken,
                expiresIn: 24 * 3600 // 24 hours
            };
        } catch (error) {
            await this.logAuthAttempt('', `oauth_${provider}`, false, request);
            
            if (error instanceof SecurityError) {
                throw error;
            }
            
            logger.error('OAuth callback error', error);
            throw new SecurityError(
                SecurityErrorType.UNAUTHORIZED,
                'OAuth authentication failed',
                500
            );
        }
    }
    
    /**
     * Refresh access token
     */
    async refreshToken(refreshToken: string): Promise<{
        accessToken: string;
        expiresIn: number;
    }> {
        const result = await this.sessionService.refreshSession(refreshToken);
        
        if (!result) {
            throw new SecurityError(
                SecurityErrorType.INVALID_TOKEN,
                'Invalid refresh token',
                401
            );
        }
        
        return result;
    }
    
    /**
     * Find or create OAuth user
     */
    private async findOrCreateOAuthUser(
        provider: OAuthProvider,
        oauthUserInfo: OAuthUserInfo
    ): Promise<schema.User> {
        // Check if user exists with this email
        let user = await this.db.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, oauthUserInfo.email.toLowerCase()))
            .get();
        
        if (!user) {
            // Create new user
            const userId = crypto.randomUUID();
            const now = new Date();
            
            await this.db.db.insert(schema.users).values({
                id: userId,
                email: oauthUserInfo.email.toLowerCase(),
                displayName: oauthUserInfo.name || oauthUserInfo.email.split('@')[0],
                avatarUrl: oauthUserInfo.picture,
                emailVerified: oauthUserInfo.emailVerified || false,
                provider: provider,
                providerId: oauthUserInfo.id,
                createdAt: now,
                updatedAt: now
            });
            
            user = await this.db.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, userId))
                .get();
        } else {
            // Always update OAuth info and user data on login
            await this.db.db
                .update(schema.users)
                .set({
                    displayName: oauthUserInfo.name || user.displayName,
                    avatarUrl: oauthUserInfo.picture || user.avatarUrl,
                    provider: provider,
                    providerId: oauthUserInfo.id,
                    emailVerified: oauthUserInfo.emailVerified || user.emailVerified,
                    updatedAt: new Date()
                })
                .where(eq(schema.users.id, user.id));
            
            // Refresh user data after updates
            user = await this.db.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.id, user.id))
                .get();
        }
        
        return user!;
    }
    
    /**
     * Log authentication attempt
     */
    private async logAuthAttempt(
        identifier: string,
        attemptType: string,
        success: boolean,
        request: Request
    ): Promise<void> {
        try {
            const requestMetadata = extractRequestMetadata(request);
            
            await this.db.db.insert(schema.authAttempts).values({
                identifier: identifier.toLowerCase(),
                attemptType: attemptType as 'login' | 'register' | 'oauth_google' | 'oauth_github' | 'refresh' | 'reset_password',
                success: success,
                ipAddress: requestMetadata.ipAddress
            });
        } catch (error) {
            logger.error('Failed to log auth attempt', error);
        }
    }
}