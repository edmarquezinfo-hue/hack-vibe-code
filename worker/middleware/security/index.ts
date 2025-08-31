/**
 * Security Middleware Exports
 */

export * from './rateLimiter';
export * from './inputValidator';
export * from './headers';
export * from './cors';
export * from '../auth/auth';
export * from '../auth/routeAuth';

import { securityHeadersMiddleware } from './headers';
import { corsMiddleware } from './cors';

/**
 * Combined security middleware that applies all security measures
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