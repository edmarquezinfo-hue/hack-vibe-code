/**
 * Base Controller Types - Pure type definitions only
 * Extracted from BaseController.ts to avoid importing logic code into frontend
 */

import { AuthUser } from "../../types/auth-types";

/**
 * Typed response wrapper for controller methods
 * Ensures controller responses match their expected interface types
 */
export type ControllerResponse<T> = Response & {
    __typedData: T; // Phantom type for compile-time checking
};

/**
 * Type-safe API response interface that ensures data is properly typed
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    data: T;
    statusCode: number;
    message?: string;
    error?: string;
}

export interface AuthResult {
    success: boolean;
    user?: AuthUser;
    response?: Response;
}