/**
 * Dispatcher Utility Functions
 * 
 * Shared utilities for checking dispatch namespace availability and handling
 * Workers for Platforms functionality across the application.
 */

export function isDispatcherAvailable(env: Env): boolean {
    // Check if DISPATCHER binding exists in the environment
    // This will be false if dispatch_namespaces is commented out in wrangler.jsonc
    // or if Workers for Platforms is not enabled for the account (as binding would be removed by the deploy.ts script)
    return 'DISPATCHER' in env && env.DISPATCHER != null;
}

/**
 * Gets the dispatcher instance from the environment if available.
 */
export function getDispatcher(env: Env): any | null {
    if (!isDispatcherAvailable(env)) {
        return null;
    }
    
    return env.DISPATCHER;
}

/**
 * Type guard to ensure dispatcher is available before use.
 */
export function hasDispatcherBinding(env: Env): env is typeof env & { DISPATCHER: any } {
    return isDispatcherAvailable(env);
}