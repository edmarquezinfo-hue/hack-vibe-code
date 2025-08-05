/**
 * Security Headers Middleware
 * Implements comprehensive security headers to prevent common attacks
 */

import { createLogger } from '../../logger';

const logger = createLogger('SecurityHeaders');

export interface SecurityHeadersConfig {
    environment: 'development' | 'staging' | 'production';
    nonce?: string;
    allowUnsafeInline?: boolean; // Only for development
}

export function addSecurityHeaders(
    response: Response,
    config: SecurityHeadersConfig
): Response {
    const headers = new Headers(response.headers);
    
    // Content Security Policy
    const csp = buildContentSecurityPolicy(config);
    headers.set('Content-Security-Policy', csp);
    
    // Strict Transport Security (HTTPS only)
    if (config.environment === 'production') {
        headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Prevent clickjacking
    headers.set('X-Frame-Options', 'DENY');
    headers.set('Frame-Options', 'DENY'); // Fallback
    
    // Prevent MIME sniffing
    headers.set('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection (legacy, but still useful)
    headers.set('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy (formerly Feature Policy)
    headers.set('Permissions-Policy', buildPermissionsPolicy());
    
    // Cross-Origin Policies
    headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Resource-Policy', 'same-site');
    
    // Cache Control for sensitive responses
    if (isSensitiveEndpoint(response)) {
        headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');
    }
    
    // Remove server identifying headers
    headers.delete('Server');
    headers.delete('X-Powered-By');
    
    // Add security identifier (without revealing implementation details)
    headers.set('X-Security-Headers', 'enabled');
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

function buildContentSecurityPolicy(config: SecurityHeadersConfig): string {
    const { environment, nonce, allowUnsafeInline = false } = config;
    
    const isDevelopment = environment === 'development';
    
    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'https:', 'data:'],
        'connect-src': ["'self'"],
        'media-src': ["'self'"],
        'object-src': ["'none'"],
        'child-src': ["'none'"],
        'frame-src': ["'none'"],
        'worker-src': ["'self'"],
        'manifest-src': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
    };
    
    // Add nonce if provided
    if (nonce) {
        directives['script-src'].push(`'nonce-${nonce}'`);
        directives['style-src'].push(`'nonce-${nonce}'`);
    }
    
    // Development-only relaxations (use sparingly)
    if (isDevelopment && allowUnsafeInline) {
        directives['script-src'].push("'unsafe-inline'");
        directives['style-src'].push("'unsafe-inline'");
        logger.warn('Using unsafe-inline in development mode');
    }
    
    // Build CSP string
    return Object.entries(directives)
        .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
        .join('; ');
}

function buildPermissionsPolicy(): string {
    const policies = [
        'accelerometer=()',
        'autoplay=()',
        'camera=()',
        'cross-origin-isolated=()',
        'display-capture=()',
        'encrypted-media=()',
        'fullscreen=()',
        'geolocation=()',
        'gyroscope=()',
        'keyboard-map=()',
        'magnetometer=()',
        'microphone=()',
        'midi=()',
        'payment=()',
        'picture-in-picture=()',
        'publickey-credentials-get=()',
        'screen-wake-lock=()',
        'sync-xhr=()',
        'usb=()',
        'web-share=()',
        'xr-spatial-tracking=()'
    ];
    
    return policies.join(', ');
}

function isSensitiveEndpoint(response: Response): boolean {
    // Check if response contains sensitive data that shouldn't be cached
    const contentType = response.headers.get('content-type') || '';
    
    // API responses are generally sensitive
    if (contentType.includes('application/json')) {
        return true;
    }
    
    // Check response headers for existing cache control
    const existingCacheControl = response.headers.get('cache-control');
    if (existingCacheControl?.includes('private') || existingCacheControl?.includes('no-cache')) {
        return true;
    }
    
    return false;
}

/**
 * Security headers middleware wrapper
 */
export async function securityHeadersMiddleware(
    _request: Request,
    response: Response,
    env: Env
): Promise<Response> {
    try {
        const config: SecurityHeadersConfig = {
            environment: (env.ENVIRONMENT || 'production') as 'development' | 'production' | 'staging',
            nonce: crypto.randomUUID(), // Generate nonce for CSP
            allowUnsafeInline: env.ENVIRONMENT === 'development'
        };
        
        return addSecurityHeaders(response, config);
    } catch (error) {
        logger.error('Error applying security headers', error);
        return response; // Return original response if header application fails
    }
}