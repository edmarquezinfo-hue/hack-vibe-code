/**
 * Base Controller Class
 * Provides common functionality for all controllers to eliminate code duplication
 */

import { DatabaseService } from '../../database/database';
import { authMiddleware } from '../../middleware/security/auth';
import { successResponse, errorResponse } from '../responses';
import { DatabaseQueryHelpers } from '../../utils/DatabaseQueryHelpers';
import { ControllerErrorHandler, ErrorHandler } from '../../utils/ErrorHandling';
import { createLogger } from '../../logger';
import { AuthUser } from '../../types/auth-types';
// Import types from separate types file to maintain consistency
import type { ControllerResponse, ApiResponse } from './BaseController.types';
import { RouteContext } from '../types/route-context';

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
    protected async findUserOwnedResource<T = Record<string, unknown>>(
        dbService: DatabaseService,
        table: unknown,
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
     * Extract authenticated user from route context
     * Type-safe approach using structured RouteContext
     */
    protected extractAuthUser(context: RouteContext): AuthUser | null {
        return context.user;
    }

    /**
     * Get optional user for public endpoints that can benefit from user context
     * Uses authMiddleware directly for optional authentication
     */
    protected async getOptionalUser(request: Request, env: Env): Promise<AuthUser | null> {
        try {
            return await authMiddleware(request, env);
        } catch (error) {
            this.logger.debug('Optional auth failed, continuing without user', { error });
            return null;
        }
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
    protected validateRequiredParams(params: Record<string, unknown>, requiredFields: string[]): void {
        ControllerErrorHandler.validateRequiredParams(params, requiredFields);
    }

    /**
     * Require authentication with standardized error
     */
    protected requireAuthentication(user: unknown): void {
        ControllerErrorHandler.requireAuthentication(user);
    }

    /**
     * Create a typed success response that enforces response interface compliance
     * This method ensures the response data matches the expected type T at compile time
     */
    protected createSuccessResponse<T>(data: T): ControllerResponse<ApiResponse<T>> {
        const response = successResponse(data) as ControllerResponse<ApiResponse<T>>;
        // The phantom type helps TypeScript understand this response contains type T
        return response;
    }

    /**
     * Create a typed error response with proper type annotation
     */
    protected createErrorResponse<T = never>(message: string, statusCode: number = 500): ControllerResponse<ApiResponse<T>> {
        const response = errorResponse(message, statusCode) as ControllerResponse<ApiResponse<T>>;
        return response;
    }

    /**
     * Execute a typed controller operation with automatic error handling and type safety
     * This method wraps controller operations to ensure they return properly typed responses
     */
    protected async executeTypedOperation<T>(
        operation: () => Promise<T>,
        operationName: string,
        context?: Record<string, any>
    ): Promise<ControllerResponse<ApiResponse<T>>> {
        try {
            const result = await operation();
            return this.createSuccessResponse(result);
        } catch (error) {
            this.logger.error(`Error in ${operationName}`, { error, context });
            const appError = ErrorHandler.handleError(error, operationName, context);
            return ErrorHandler.toResponse(appError) as ControllerResponse<ApiResponse<T>>;
        }
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