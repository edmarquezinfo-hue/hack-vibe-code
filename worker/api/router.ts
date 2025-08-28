import { createObjectLogger, StructuredLogger } from '../logger';
import { methodNotAllowedResponse } from './responses';
import { routeAuthMiddleware, AuthRequirement as AuthMiddlewareRequirement, checkAppOwnership } from '../middleware/security/routeAuth';
import { RouteContext, ContextualRequestHandler } from './types/route-context';
import { AuthUser } from '../types/auth-types';

// Re-export types for external use
export type { ContextualRequestHandler, RouteContext };


/**
 * Authentication requirement for routes
 */
export interface AuthRequirement {
    required: boolean;
    allowAnonymous?: boolean;
    level?: 'authenticated' | 'owner-only';
    resourceOwnershipCheck?: (user: AuthUser, params: Record<string, string>, env: Env) => Promise<boolean>;
}

/**
 * Common auth requirement configurations
 */
export const AuthConfig = {
    // Public route - no authentication required
    public: undefined,
    
    // Require full authentication (no anonymous users)
    authenticated: { 
        required: true, 
        level: 'authenticated' as const 
    },
    
    // Require resource ownership (for app editing)
    ownerOnly: { 
        required: true, 
        level: 'owner-only' as const,
        resourceOwnershipCheck: checkAppOwnership
    },
    
    // Public read access, but owner required for modifications
    // This will be handled by the controller logic to distinguish read vs write
    publicReadOwnerWrite: { 
        required: false 
    }
} as const;

/**
 * Route definition
 */
export interface Route {
    path: string;
    handler: ContextualRequestHandler;
    methods: string[];
    auth?: AuthRequirement;
}

/**
 * Router class for handling HTTP requests
 */
export class Router {
    private routes: Route[] = [];
    private logger: StructuredLogger;

    constructor() {
        this.logger = createObjectLogger(this, 'Router');
    }

    /**
     * Register a new route (all routes now use contextual handlers)
     */
    register(
        path: string, 
        handler: ContextualRequestHandler, 
        methods: string[] = ['GET'], 
        auth?: AuthRequirement
    ): Router {
        this.routes.push({
            path,
            handler,
            methods: methods.map(method => method.toUpperCase()),
            auth
        });
        return this;
    }

    /**
     * Register a GET route
     */
    get(path: string, handler: ContextualRequestHandler, auth?: AuthRequirement): Router {
        return this.register(path, handler, ['GET'], auth);
    }

    /**
     * Register a POST route
     */
    post(path: string, handler: ContextualRequestHandler, auth?: AuthRequirement): Router {
        return this.register(path, handler, ['POST'], auth);
    }

    /**
     * Register a PUT route
     */
    put(path: string, handler: ContextualRequestHandler, auth?: AuthRequirement): Router {
        return this.register(path, handler, ['PUT'], auth);
    }

    /**
     * Register a DELETE route
     */
    delete(path: string, handler: ContextualRequestHandler, auth?: AuthRequirement): Router {
        return this.register(path, handler, ['DELETE'], auth);
    }

    /**
     * Register a PATCH route
     */
    patch(path: string, handler: ContextualRequestHandler, auth?: AuthRequirement): Router {
        return this.register(path, handler, ['PATCH'], auth);
    }

    /**
     * Register a route with multiple methods
     */
    methods(path: string, handler: ContextualRequestHandler, methods: string[], auth?: AuthRequirement): Router {
        return this.register(path, handler, methods, auth);
    }

    /**
     * Match a request to a route
     * Supports path parameters with :param syntax
     */
    private matchRoute(request: Request): { route: Route; params: Record<string, string> } | null {
        const url = new URL(request.url);
        const method = request.method.toUpperCase();
        const requestPath = url.pathname;

        for (const route of this.routes) {
            // Check if method is allowed
            if (!route.methods.includes(method)) {
                continue;
            }

            // Split paths into segments for matching
            const routeSegments = route.path.split('/').filter(Boolean);
            const requestSegments = requestPath.split('/').filter(Boolean);

            // Quick length check
            if (
                routeSegments.length !== requestSegments.length &&
                !route.path.includes('*')
            ) {
                continue;
            }

            // Check for exact match
            if (route.path === requestPath) {
                return { route, params: {} };
            }

            // Check for wildcard match (e.g., /api/*)
            if (route.path.endsWith('*')) {
                const basePathSegments = route.path.slice(0, -1).split('/').filter(Boolean);
                const requestBaseSegments = requestSegments.slice(0, basePathSegments.length);

                if (basePathSegments.join('/') === requestBaseSegments.join('/')) {
                    return { route, params: {} };
                }
                continue;
            }

            // Check for param match (e.g., /users/:id)
            const params: Record<string, string> = {};
            let isMatch = true;

            for (let i = 0; i < routeSegments.length; i++) {
                const routeSegment = routeSegments[i];
                const requestSegment = requestSegments[i];

                if (routeSegment.startsWith(':')) {
                    // This is a path parameter
                    const paramName = routeSegment.slice(1);
                    params[paramName] = requestSegment;
                } else if (routeSegment !== requestSegment) {
                    // Segments don't match
                    isMatch = false;
                    break;
                }
            }

            if (isMatch) {
                return { route, params };
            }
        }

        return null;
    }

    /**
     * Handle a request
     */
    async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        try {
            const match = this.matchRoute(request);

            if (!match) {
                // this.logger.warn(`No route found for ${request.method} ${new URL(request.url).pathname}`);
                // return notFoundResponse('Route');
                return env.ASSETS.fetch(request);
            }

            const { route, params } = match;

            // Check if method is allowed for this route
            if (!route.methods.includes(request.method.toUpperCase())) {
                this.logger.warn(`Method ${request.method} not allowed for ${new URL(request.url).pathname}`);
                return methodNotAllowedResponse(route.methods);
            }

            this.logger.info(`Matched route: ${request.method} ${route.path}`);
            
            let authenticatedUser: AuthUser | null = null;
            
            // Apply authentication middleware if required
            if (route.auth?.required) {
                const authRequirement: AuthMiddlewareRequirement = {
                    level: route.auth.level === 'owner-only' ? 'owner-only' : 'authenticated',
                    allowAnonymous: route.auth.allowAnonymous,
                    resourceOwnershipCheck: route.auth.resourceOwnershipCheck
                };
                
                const authResult = await routeAuthMiddleware(request, env, authRequirement, params);
                if (!authResult.success) {
                    return authResult.response!;
                }
                
                authenticatedUser = authResult.user || null;
            }
            
            // Create structured route context
            const url = new URL(request.url);
            const routeContext: RouteContext = {
                user: authenticatedUser,
                pathParams: params || {},
                queryParams: url.searchParams
            };
            
            // All handlers now use contextual approach for type safety
            return await (route.handler as ContextualRequestHandler)(request, env, ctx, routeContext);
        } catch (error) {
            this.logger.error('Error handling request', error);
            throw error;
        }
    }
}
