/**
 * Authentication Routes
 * Clean routing definitions with controller delegation
 */

import { Router, AuthConfig } from '../router';
import { AuthController } from '../controllers/auth/controller';
import { ContextualRequestHandler, RouteContext } from '../types/route-context';
// Removed redundant authMiddleware import - AuthController methods handle their own authentication

/**
 * Setup authentication routes
 * All business logic is delegated to the controller
 */
export function setupAuthRoutes(router: Router): Router {
    // Create contextual handler - all methods now use the same signature
    const createHandler = (method: keyof AuthController): ContextualRequestHandler => {
        return async (request: Request, env: Env, ctx: ExecutionContext, routeContext: RouteContext) => {
            const url = new URL(request.url);
            const controller = new AuthController(env, url.origin);
            // All methods now have the same ContextualRequestHandler signature
            return controller[method](request, env, ctx, routeContext);
        };
    };
    
    // Public authentication routes
    router.get('/api/auth/providers', createHandler('getAuthProviders'));
    router.post('/api/auth/register', createHandler('register'));
    router.post('/api/auth/login', createHandler('login'));
    router.post('/api/auth/verify-email', createHandler('verifyEmail'));
    router.post('/api/auth/resend-verification', createHandler('resendVerificationOtp'));
    router.post('/api/auth/refresh', createHandler('refreshToken'));
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
