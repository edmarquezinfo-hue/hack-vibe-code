/**
 * Dispatcher Utility Functions
 * 
 * Shared utilities for checking dispatch namespace availability and handling
 * Workers for Platforms functionality across the application.
 * 
 * This module provides a single source of truth for dispatch namespace
 * availability checks, following DRY principles.
 */

/**
 * Checks if the DISPATCHER binding is available in the current environment.
 * 
 * This function determines whether Workers for Platforms dispatch namespaces
 * are available and properly configured. It's used throughout the application
 * to conditionally enable dispatch namespace functionality.
 * 
 * @param env - The Cloudflare Workers environment containing bindings
 * @returns true if DISPATCHER binding exists and is available, false otherwise
 * 
 * @example
 * ```typescript
 * import { isDispatcherAvailable } from './utils/dispatcherUtils';
 * 
 * if (isDispatcherAvailable(env)) {
 *   // Use dispatch namespace functionality
 *   const dispatcher = env.DISPATCHER;
 *   // ... dispatch logic
 * } else {
 *   // Fall back to standard Workers functionality
 * }
 * ```
 */
export function isDispatcherAvailable(env: any): boolean {
    // Check if DISPATCHER binding exists in the environment
    // This will be false if dispatch_namespaces is commented out in wrangler.jsonc
    // or if Workers for Platforms is not enabled for the account
    return 'DISPATCHER' in env && env.DISPATCHER != null;
}

/**
 * Gets the dispatcher instance from the environment if available.
 * 
 * @param env - The Cloudflare Workers environment containing bindings
 * @returns The dispatcher instance or null if not available
 * 
 * @example
 * ```typescript
 * const dispatcher = getDispatcher(env);
 * if (dispatcher) {
 *   const worker = dispatcher.get(subdomain);
 *   // ... use worker
 * }
 * ```
 */
export function getDispatcher(env: any): any | null {
    if (!isDispatcherAvailable(env)) {
        return null;
    }
    
    return env.DISPATCHER;
}

/**
 * Type guard to ensure dispatcher is available before use.
 * Provides better TypeScript support for dispatch namespace operations.
 * 
 * @param env - The Cloudflare Workers environment containing bindings
 * @returns true if env has DISPATCHER binding (type guard)
 */
export function hasDispatcherBinding(env: any): env is typeof env & { DISPATCHER: any } {
    return isDispatcherAvailable(env);
}