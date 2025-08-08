/**
 * CORS (Cross-Origin Resource Sharing) Middleware for Cloudflare Workers
 * Configures CORS based on environment with secure defaults
 */

import { createLogger } from '../../logger';

const logger = createLogger('CORS');

/**
 * CORS configuration based on environment
 */
interface CORSConfig {
    origins: string[];
    credentials: boolean;
    maxAge?: number;
    methods?: string[];
    headers?: string[];
}

/**
 * Get CORS configuration for current environment
 */
function getCORSConfig(env: Env): CORSConfig {
    const configs: Record<string, CORSConfig> = {
        development: {
            origins: [
                'http://localhost:5173',
                'http://localhost:3000',
                'http://127.0.0.1:5173',
                'http://127.0.0.1:3000',
                'https://build.ashishkumarsingh.com',
                'https://build.chat.cloudflare.dev',
                'https://build.cloudflare.dev',
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
            headers: ['Content-Type', 'Authorization', 'X-Requested-With']
        },
        staging: {
            origins: [
                'https://build.chat.cloudflare.dev',
                'https://build.cloudflare.dev',
            ],
            credentials: true,
            maxAge: 3600, // 1 hour
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
            headers: ['Content-Type', 'Authorization', 'X-Requested-With']
        },
        production: {
            origins: [
                'https://build.chat.cloudflare.dev',
                'https://build.cloudflare.dev',
            ],
            credentials: true,
            maxAge: 86400, // 24 hours
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            headers: ['Content-Type', 'Authorization']
        }
    };
    
    const environment = env.ENVIRONMENT || 'development';
    return configs[environment] || configs.development;
}

/**
 * Apply CORS headers to response
 */
export function applyCORSHeaders(
    request: Request,
    response: Response,
    env: Env
): Response {
    const origin = request.headers.get('Origin');
    const config = getCORSConfig(env);
    
    // If no origin or origin not allowed, return response without CORS headers
    if (!origin || !isOriginAllowed(origin, config.origins, env)) {
        logger.debug('CORS: Origin not allowed', { origin, allowed: config.origins });
        return response;
    }
    
    // Clone response to modify headers
    const newResponse = new Response(response.body, response);
    const headers = new Headers(newResponse.headers);
    
    // Set CORS headers
    headers.set('Access-Control-Allow-Origin', origin);
    
    if (config.credentials) {
        headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', config.methods?.join(', ') || 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', config.headers?.join(', ') || 'Content-Type');
        
        if (config.maxAge) {
            headers.set('Access-Control-Max-Age', String(config.maxAge));
        }
    }
    
    // Add Vary header to indicate response varies by origin
    const existingVary = headers.get('Vary');
    if (existingVary) {
        headers.set('Vary', `${existingVary}, Origin`);
    } else {
        headers.set('Vary', 'Origin');
    }
    
    logger.debug('CORS headers applied', { origin, path: new URL(request.url).pathname });
    
    return new Response(newResponse.body, {
        status: newResponse.status,
        statusText: newResponse.statusText,
        headers
    });
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string, allowedOrigins: string[], env: Env): boolean {
    // Exact match
    if (allowedOrigins.includes(origin)) {
        return true;
    }
    
    // In development, be more permissive with localhost
    if (env.ENVIRONMENT === 'development') {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            return true;
        }
    }
    
    for (const allowed of allowedOrigins) {
        if (allowed.includes('*')) {
            const pattern = allowed
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*');
            const regex = new RegExp(`^${pattern}$`);
            if (regex.test(origin)) {
                return true;
            }
        }
    }
    
    return false;
}

/**
 * CORS middleware
 */
export async function corsMiddleware(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
    next: () => Promise<Response>
): Promise<Response> {
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
        const response = new Response(null, { status: 204 });
        return applyCORSHeaders(request, response, env);
    }
    
    // Process request
    const response = await next();
    
    // Apply CORS headers to response
    return applyCORSHeaders(request, response, env);
}

/**
 * Create a CORS-enabled response
 */
export function createCORSResponse(
    body: BodyInit | null,
    init: ResponseInit,
    request: Request,
    env: Env
): Response {
    const response = new Response(body, init);
    return applyCORSHeaders(request, response, env);
}

/**
 * Handle CORS preflight requests
 */
export function handleCORSPreflight(request: Request, env: Env): Response {
    const response = new Response(null, {
        status: 204,
        statusText: 'No Content'
    });
    
    return applyCORSHeaders(request, response, env);
}

/**
 * Check if request is a CORS request
 */
export function isCORSRequest(request: Request): boolean {
    return request.headers.has('Origin') && 
                 request.headers.get('Origin') !== new URL(request.url).origin;
}

/**
 * Get allowed origins for current environment
 */
export function getAllowedOrigins(env: Env): string[] {
    const config = getCORSConfig(env);
    return config.origins;
}