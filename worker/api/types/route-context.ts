/**
 * Route Context Types
 * Provides structured, type-safe context for route handlers
 */

import { AuthUser } from '../../types/auth-types';

/**
 * Route context containing authenticated user and path parameters
 * This replaces the hacky JSON parsing approach with proper type safety
 */
export interface RouteContext {
    /**
     * Authenticated user (null if not authenticated or public route)
     */
    user: AuthUser | null;
    
    /**
     * Path parameters extracted from the route (e.g., :id, :agentId)
     */
    pathParams: Record<string, string>;
    
    /**
     * Query parameters from the URL
     */
    queryParams: URLSearchParams;
}

/**
 * Extended request handler that receives structured context
 */
export type ContextualRequestHandler = (
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    context: RouteContext
) => Promise<Response>;

/**
 * Route parameter configuration for type safety
 */
export interface RouteParamConfig {
    /**
     * Required path parameters for this route
     */
    requiredParams?: string[];
    
    /**
     * Optional path parameters for this route
     */
    optionalParams?: string[];
}