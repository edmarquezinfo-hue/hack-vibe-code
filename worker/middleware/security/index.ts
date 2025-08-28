/**
 * Security Middleware Exports
 * Central export point for all security middleware components
 */

export * from './rateLimiter';
export * from './inputValidator';
export * from './headers';
export * from './cors';
export * from './auth';
export * from './routeAuth';

import { rateLimitMiddleware } from './rateLimiter';
import { validateInput } from './inputValidator';
import { securityHeadersMiddleware } from './headers';
import { corsMiddleware } from './cors';
import { authMiddleware } from './auth';
import { routeAuthMiddleware } from './routeAuth';

/**
 * Combined security middleware that applies all security measures
 * Can be used as a single middleware in routes
 */
export async function applySecurityMiddleware(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    next: () => Promise<Response>
): Promise<Response> {
    // Apply CORS first (handles preflight)
    return corsMiddleware(request, env, ctx, async () => {
        // Then apply security headers
        const response = await next();
        return securityHeadersMiddleware(request, response, env);
    });
}

/**
 * Export grouped middleware for easy access
 */
export const security = {
    rateLimit: rateLimitMiddleware,
    validateInput,
    headers: securityHeadersMiddleware,
    cors: corsMiddleware,
    auth: authMiddleware,
    routeAuth: routeAuthMiddleware,
    applyAll: applySecurityMiddleware
};