/**
 * Authentication Routes
 */

import { Router, AuthConfig } from '../router';
import { AuthController } from '../controllers/auth/controller';
import { ContextualRequestHandler, RouteContext } from '../types/route-context';
import { enforceAuthRateLimit, RateLimitContext } from '../../middleware/security/rateLimiter';
import { authMiddleware } from '../../middleware/auth/auth';

/**
 * Setup authentication routes
 */
export function setupAuthRoutes(_env: Env, router: Router): Router {
    // Create contextual handler - all methods now use the same signature
    const createHandler = (
        method: keyof AuthController,
        applyAuthRateLimit: boolean = false
    ): ContextualRequestHandler => {
        return async (request: Request, env: Env, ctx: ExecutionContext, routeContext: RouteContext) => {
            if (applyAuthRateLimit) {
                // Extract user for rate limiting context
                const user = await authMiddleware(request, env);
                const rateLimitContext: RateLimitContext = { request, user };
                await enforceAuthRateLimit(rateLimitContext, env);
            }
            const url = new URL(request.url);
            const controller = new AuthController(env, url.origin);
            return controller[method](request, env, ctx, routeContext);
        };
    };
    
    // Public authentication routes
    router.get('/api/auth/providers', createHandler('getAuthProviders'));
    router.post('/api/auth/register', createHandler('register', true));
    router.post('/api/auth/login', createHandler('login', true));
    router.post('/api/auth/verify-email', createHandler('verifyEmail', true));
    router.post('/api/auth/resend-verification', createHandler('resendVerificationOtp', true));
    router.post('/api/auth/refresh', createHandler('refreshToken', true));
    router.get('/api/auth/check', createHandler('checkAuth'));
    
    // Protected routes (require authentication) - must come before dynamic OAuth routes
    router.get('/api/auth/profile', createHandler('getProfile'), AuthConfig.authenticated);
    router.put('/api/auth/profile', createHandler('updateProfile'), AuthConfig.authenticated);
    router.post('/api/auth/logout', createHandler('logout'));
    
    // Session management routes
    router.get('/api/auth/sessions', createHandler('getActiveSessions'), AuthConfig.authenticated);
    router.delete('/api/auth/sessions/:sessionId', createHandler('revokeSession'), AuthConfig.authenticated);
    
    // API Keys management routes
    router.get('/api/auth/api-keys', createHandler('getApiKeys'), AuthConfig.authenticated);
    router.post('/api/auth/api-keys', createHandler('createApiKey'), AuthConfig.authenticated);
    router.delete('/api/auth/api-keys/:keyId', createHandler('revokeApiKey'), AuthConfig.authenticated);
    
    // OAuth routes (under /oauth path to avoid conflicts)
    router.get('/api/auth/oauth/:provider', createHandler('initiateOAuth'));
    router.get('/api/auth/callback/:provider', createHandler('handleOAuthCallback'));
    
    return router;
}
