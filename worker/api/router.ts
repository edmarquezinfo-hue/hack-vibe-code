import { createObjectLogger, StructuredLogger } from '../logger';
import { methodNotAllowedResponse } from './responses';

/**
 * Request handler function type
 */
export type RequestHandler = (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    params?: Record<string, string>
) => Promise<Response>;

/**
 * Route definition
 */
export interface Route {
    path: string;
    handler: RequestHandler;
    methods: string[];
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
     * Register a new route
     */
    register(path: string, handler: RequestHandler, methods: string[] = ['GET']): Router {
        this.routes.push({
            path,
            handler,
            methods: methods.map(method => method.toUpperCase())
        });
        return this;
    }

    /**
     * Register a GET route
     */
    get(path: string, handler: RequestHandler): Router {
        return this.register(path, handler, ['GET']);
    }

    /**
     * Register a POST route
     */
    post(path: string, handler: RequestHandler): Router {
        return this.register(path, handler, ['POST']);
    }

    /**
     * Register a PUT route
     */
    put(path: string, handler: RequestHandler): Router {
        return this.register(path, handler, ['PUT']);
    }

    /**
     * Register a DELETE route
     */
    delete(path: string, handler: RequestHandler): Router {
        return this.register(path, handler, ['DELETE']);
    }

    /**
     * Register a route with multiple methods
     */
    methods(path: string, handler: RequestHandler, methods: string[]): Router {
        return this.register(path, handler, methods);
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
            return await route.handler(request, env, ctx, params);
        } catch (error) {
            this.logger.error('Error handling request', error);
            throw error;
        }
    }
}