/**
 * Standardized API response utilities
 */

/**
 * Standard response shape for all API endpoints
 */
export interface BaseApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    statusCode: number;
}

/**
 * Creates a success response with standard format
 */
export function successResponse<T = unknown>(data: T, message?: string): Response {
    const responseBody: BaseApiResponse<T> = {
        success: true,
        data,
        message,
        statusCode: 200
    };

    return new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

/**
 * Creates a created response (201) with standard format
 */
export function createdResponse<T = unknown>(data: T, message?: string): Response {
    const responseBody: BaseApiResponse<T> = {
        success: true,
        data,
        message: message || 'Resource created successfully',
        statusCode: 201
    };

    return new Response(JSON.stringify(responseBody), {
        status: 201,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

/**
 * Creates an error response with standard format
 */
export function errorResponse(error: string | Error, statusCode = 500, message?: string): Response {
    const errorMessage = error instanceof Error ? error.message : error;

    const responseBody: BaseApiResponse = {
        success: false,
        error: errorMessage,
        message: message || 'An error occurred',
        statusCode
    };

    return new Response(JSON.stringify(responseBody), {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

/**
 * Creates a bad request response (400)
 */
export function badRequestResponse(message: string): Response {
    return errorResponse(message, 400, 'Bad request');
}

/**
 * Creates a not found response (404)
 */
export function notFoundResponse(resource: string): Response {
    return errorResponse(`${resource} not found`, 404, 'Not found');
}

/**
 * Creates a method not allowed response (405)
 */
export function methodNotAllowedResponse(allowedMethods: string[]): Response {
    return errorResponse(
        'Method not allowed',
        405,
        `Allowed methods: ${allowedMethods.join(', ')}`
    );
}