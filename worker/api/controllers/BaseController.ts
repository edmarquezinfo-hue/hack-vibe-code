/**
 * Base Controller Class
 * Provides common functionality for all controllers to eliminate code duplication
 */

import { DatabaseService } from '../../database/database';
import { authMiddleware } from '../../middleware/security/auth';
import { errorResponse, successResponse } from '../responses';
import { extractToken } from '../../utils/authUtils';
import { SessionService } from '../../services/auth/sessionService';
import { TokenService } from '../../services/auth/tokenService';
import { DatabaseQueryHelpers } from '../../utils/DatabaseQueryHelpers';
import { ControllerErrorHandler, ErrorHandler } from '../../utils/ErrorHandling';
import { createLogger } from '../../logger';
import { AuthUser } from '../../types/auth-types';

export interface AuthResult {
    success: boolean;
    user?: AuthUser;
    response?: Response;
}

/**
 * Base controller class that provides common functionality
 */
export abstract class BaseController {
    protected logger = createLogger(this.constructor.name);

    /**
     * Create a database service instance
     */
    protected createDbService(env: Env): DatabaseService {
        return DatabaseQueryHelpers.createDbService(env);
    }

    /**
     * Find a user-owned resource with ownership verification
     */
    protected async findUserOwnedResource<T>(
        dbService: DatabaseService,
        table: any,
        resourceId: string,
        userId: string,
        resourceIdField: string = 'id'
    ): Promise<T[]> {
        return DatabaseQueryHelpers.findUserOwnedResource<T>(
            dbService, 
            table, 
            resourceId, 
            userId, 
            resourceIdField
        );
    }

    /**
     * Update a user-owned resource with ownership verification
     */
    protected async updateUserOwnedResource(
        dbService: DatabaseService,
        table: unknown,
        resourceId: string,
        userId: string,
        updateData: Record<string, unknown>,
        resourceIdField: string = 'id'
    ): Promise<boolean> {
        return DatabaseQueryHelpers.updateUserOwnedResource(
            dbService,
            table,
            resourceId,
            userId,
            updateData,
            resourceIdField
        );
    }

    /**
     * Require authentication for the request
     * Returns user if authenticated, or error response if not
     */
    protected async requireAuth(request: Request, env: Env): Promise<AuthResult> {
        try {
            const user = await authMiddleware(request, env);
            if (!user) {
                return {
                    success: false,
                    response: errorResponse('Unauthorized', 401)
                };
            }
            
            return {
                success: true,
                user
            };
        } catch (error) {
            this.logger.error('Authentication failed', error);
            return {
                success: false,
                response: errorResponse('Authentication failed', 401)
            };
        }
    }

    /**
     * Get session from request using token validation
     */
    protected async getSessionFromRequest(request: Request, env: Env) {
        const token = extractToken(request);
        if (!token) return null;
        
        const db = new DatabaseService({ DB: env.DB });
        const sessionService = new SessionService(
            db,
            new TokenService(env)
        );
        return sessionService.validateSession(token);
    }

    /**
     * Extract path parameters from URL
     */
    protected extractPathParams(request: Request, paramNames: string[]): Record<string, string> {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const params: Record<string, string> = {};
        
        paramNames.forEach((paramName, index) => {
            const paramIndex = pathParts.length - paramNames.length + index;
            if (paramIndex >= 0 && paramIndex < pathParts.length) {
                params[paramName] = pathParts[paramIndex];
            }
        });
        
        return params;
    }

    /**
     * Parse query parameters from request URL
     */
    protected parseQueryParams(request: Request): URLSearchParams {
        const url = new URL(request.url);
        return url.searchParams;
    }

    /**
     * Parse JSON body from request with error handling
     */
    protected async parseJsonBody<T>(request: Request): Promise<{ success: boolean; data?: T; response?: Response }> {
        try {
            const body = await ControllerErrorHandler.parseJsonBody<T>(request);
            return { success: true, data: body };
        } catch (error) {
            const appError = ErrorHandler.handleError(error, 'parse JSON body');
            return {
                success: false,
                response: ErrorHandler.toResponse(appError)
            };
        }
    }

    /**
     * Handle errors with consistent logging and response format
     */
    protected handleError(error: unknown, action: string, context?: Record<string, unknown>): Response {
        const appError = ErrorHandler.handleError(error, action, context);
        return ErrorHandler.toResponse(appError);
    }

    /**
     * Execute controller operation with error handling
     */
    protected async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        operationName: string,
        context?: Record<string, any>
    ): Promise<T | Response> {
        return ControllerErrorHandler.handleControllerOperation(operation, operationName, context);
    }

    /**
     * Validate required parameters
     */
    protected validateRequiredParams(params: Record<string, any>, requiredFields: string[]): void {
        ControllerErrorHandler.validateRequiredParams(params, requiredFields);
    }

    /**
     * Require authentication with standardized error
     */
    protected requireAuthentication(user: any): void {
        ControllerErrorHandler.requireAuthentication(user);
    }

    /**
     * Create a standardized success response
     */
    protected createSuccessResponse<T>(data: T): Response {
        return successResponse(data);
    }

    /**
     * Create a standardized error response
     */
    protected createErrorResponse(message: string, statusCode: number = 500): Response {
        return errorResponse(message, statusCode);
    }

    /**
     * Extract client IP address from request headers
     */
    protected getClientIpAddress(request: Request): string {
        return request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0] || 
               'unknown';
    }

    /**
     * Extract user agent from request headers
     */
    protected getUserAgent(request: Request): string {
        return request.headers.get('user-agent') || 'unknown';
    }

}