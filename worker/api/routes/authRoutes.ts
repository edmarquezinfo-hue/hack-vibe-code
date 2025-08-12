/**
 * Authentication Routes
 * Clean routing definitions with controller delegation
 */

import { Router } from '../router';
import { AuthController } from '../controllers/authController';
// Removed redundant authMiddleware import - AuthController methods handle their own authentication

/**
 * Setup authentication routes
 * All business logic is delegated to the controller
 */
export function setupAuthRoutes(router: Router): Router {
    // Create auth controller functions that capture env
    const createAuthHandler = (method: keyof AuthController) => {
        return async (request: Request, env: Env, _ctx: ExecutionContext) => {
            const url = new URL(request.url);
            const controller = new AuthController(env, url.origin);
            return controller[method](request);
        };
    };

    // Protected route handler (auth is handled by controller methods themselves)
    const createProtectedHandler = (method: keyof AuthController) => {
        return async (request: Request, env: Env, _ctx: ExecutionContext) => {
            const url = new URL(request.url);
            const controller = new AuthController(env, url.origin);
            return controller[method](request);
        };
    };
    
    // Public authentication routes
    router.post('/api/auth/register', createAuthHandler('register'));
    router.post('/api/auth/login', createAuthHandler('login'));
    router.post('/api/auth/refresh', createAuthHandler('refreshToken'));
    router.get('/api/auth/check', createAuthHandler('checkAuth'));
    
    // Protected routes (require authentication) - must come before dynamic OAuth routes
    router.get('/api/auth/profile', createProtectedHandler('getProfile'));
    router.put('/api/auth/profile', createProtectedHandler('updateProfile'));
    router.post('/api/auth/logout', createAuthHandler('logout'));
    
    // Session management routes
    router.get('/api/auth/sessions', createProtectedHandler('getActiveSessions'));
    router.delete('/api/auth/sessions/:sessionId', createProtectedHandler('revokeSession'));
    
    // API Keys management routes
    router.get('/api/auth/api-keys', createProtectedHandler('getApiKeys'));
    router.post('/api/auth/api-keys', createProtectedHandler('createApiKey'));
    router.delete('/api/auth/api-keys/:keyId', createProtectedHandler('revokeApiKey'));
    
    // OAuth routes (under /oauth path to avoid conflicts)
    router.get('/api/auth/oauth/:provider', createAuthHandler('initiateOAuth'));
    router.get('/api/auth/callback/:provider', createAuthHandler('handleOAuthCallback'));
    
    return router;
}