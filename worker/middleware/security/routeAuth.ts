/**
 * Route Authentication Middleware
 * Provides granular authentication requirements for routes
 */

import { AuthUser } from '../../types/auth-types';
import { authMiddleware } from './auth';
import { createLogger } from '../../logger';
import { DatabaseService } from '../../database/database';
import * as schema from '../../database/schema';
import { eq } from 'drizzle-orm';

const logger = createLogger('RouteAuth');

/**
 * Authentication levels for route protection
 */
export type AuthLevel = 'public' | 'authenticated' | 'owner-only';

/**
 * Authentication requirement configuration
 */
export interface AuthRequirement {
    level: AuthLevel;
    allowAnonymous?: boolean; // For authenticated level, whether to allow anonymous users
    resourceOwnershipCheck?: (user: AuthUser, params: Record<string, string>, env: Env) => Promise<boolean>;
}

/**
 * Route authentication middleware that enforces authentication requirements
 */
export async function routeAuthMiddleware(
    request: Request,
    env: Env,
    requirement: AuthRequirement,
    params?: Record<string, string>
): Promise<{ success: boolean; user?: AuthUser; response?: Response }> {
    try {
        // Public routes always pass
        if (requirement.level === 'public') {
            return { success: true };
        }

        // Get user from auth middleware
        const user = await authMiddleware(request, env);

        // For authenticated routes
        if (requirement.level === 'authenticated') {
            if (!user) {
                return {
                    success: false,
                    response: createAuthRequiredResponse()
                };
            }

            // Check if anonymous users are allowed for this route
            if (user.isAnonymous && !requirement.allowAnonymous) {
                return {
                    success: false,
                    response: createAuthRequiredResponse('Full account required')
                };
            }

            return { success: true, user };
        }

        // For owner-only routes
        if (requirement.level === 'owner-only') {
            if (!user || user.isAnonymous) {
                return {
                    success: false,
                    response: createAuthRequiredResponse('Account required')
                };
            }

            // Check resource ownership if function provided
            if (requirement.resourceOwnershipCheck && params) {
                const isOwner = await requirement.resourceOwnershipCheck(user, params, env);
                if (!isOwner) {
                    return {
                        success: false,
                        response: createForbiddenResponse('You can only access your own resources')
                    };
                }
            }

            return { success: true, user };
        }

        // Default fallback
        return { success: true };
    } catch (error) {
        logger.error('Error in route auth middleware', error);
        return {
            success: false,
            response: new Response(JSON.stringify({
                success: false,
                error: 'Authentication check failed'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        };
    }
}

/**
 * Decorator function for easy route protection
 */
export function requireAuth(requirement: AuthRequirement) {
    return function(originalMethod: Function, _context: ClassMethodDecoratorContext) {
        return async function(this: any, request: Request, env: Env, ctx: ExecutionContext, params?: Record<string, string>) {
            const authResult = await routeAuthMiddleware(request, env, requirement, params);
            
            if (!authResult.success) {
                return authResult.response!;
            }

            // Call original method with auth context
            return originalMethod.call(this, request, env, ctx, params, authResult.user);
        };
    };
}

/**
 * Create standardized authentication required response
 */
function createAuthRequiredResponse(message?: string): Response {
    return new Response(JSON.stringify({
        success: false,
        error: {
            type: 'AUTHENTICATION_REQUIRED',
            message: message || 'Authentication required',
            action: 'login'
        }
    }), {
        status: 401,
        headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="API"'
        }
    });
}

/**
 * Create standardized forbidden response
 */
function createForbiddenResponse(message: string): Response {
    return new Response(JSON.stringify({
        success: false,
        error: {
            type: 'FORBIDDEN',
            message,
            action: 'insufficient_permissions'
        }
    }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Common auth requirements for reuse
 */
export const AuthRequirements = {
    public: { level: 'public' as AuthLevel },
    authenticated: { level: 'authenticated' as AuthLevel },
    ownerOnly: { level: 'owner-only' as AuthLevel }
} as const;

/**
 * Middleware factory for specific authentication patterns
 */
export const AuthMiddleware = {
    /**
     * Require full authentication (no anonymous users)
     */
    requireFullAuth: async (request: Request, env: Env, params?: Record<string, string>) => {
        return routeAuthMiddleware(request, env, AuthRequirements.authenticated, params);
    },

    /**
     * Public route (no authentication required)
     */
    public: async (request: Request, env: Env, params?: Record<string, string>) => {
        return routeAuthMiddleware(request, env, AuthRequirements.public, params);
    },

    /**
     * Require resource ownership
     */
    requireOwnership: (ownershipCheck: (user: AuthUser, params: Record<string, string>, env: Env) => Promise<boolean>) => {
        return async (request: Request, env: Env, params?: Record<string, string>) => {
            return routeAuthMiddleware(request, env, {
                level: 'owner-only',
                resourceOwnershipCheck: ownershipCheck
            }, params);
        };
    }
};

/**
 * Check if user owns an app by agent/app ID
 */
export async function checkAppOwnership(user: AuthUser, params: Record<string, string>, env: Env): Promise<boolean> {
    try {
        const agentId = params.agentId || params.id;
        if (!agentId) {
            return false;
        }

        const dbService = new DatabaseService({ DB: env.DB });
        const app = await dbService.db
            .select({ userId: schema.apps.userId })
            .from(schema.apps)
            .where(eq(schema.apps.id, agentId))
            .get();

        if (!app) {
            return false; // App doesn't exist
        }

        // Check if user is the owner
        return app.userId === user.id;
    } catch (error) {
        logger.error('Error checking app ownership', error);
        return false;
    }
}