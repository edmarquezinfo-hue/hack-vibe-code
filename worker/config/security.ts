/**
 * Centralized Security Configuration
 */

import { DEFAULT_RATE_LIMIT_SETTINGS, RateLimitSettings } from "../services/rate-limit/config";
import { Context } from "hono";

interface CORSConfig {
    origin: string | string[];// | ((origin: string, c: Context) => Promise<string | undefined | null> | string | undefined | null);
    allowMethods?: string[] | ((origin: string, c: Context) => Promise<string[]> | string[]);
    allowHeaders?: string[];
    maxAge?: number;
    credentials?: boolean;
    exposeHeaders?: string[];
}

// These settings can be altered dynamically via e.g, admin panel
export interface ConfigurableSecuritySettings {
    rateLimit: RateLimitSettings;
}

export function getDefaultSecuritySettings(): ConfigurableSecuritySettings {
    
    return {
        rateLimit: DEFAULT_RATE_LIMIT_SETTINGS,
    };
}

function getAllowedOrigins(env: Env): string[] {
    const origins: string[] = [];
    
    // Production domains
    if (env.CUSTOM_DOMAIN) {
        origins.push(`https://${env.CUSTOM_DOMAIN}`);
    }
    
    // Development origins
    if (env.ENVIRONMENT === 'development') {
        origins.push('http://localhost:3000');
        origins.push('http://localhost:5173');
        origins.push('http://127.0.0.1:3000');
        origins.push('http://127.0.0.1:5173');
    }
    
    return origins;
}

export function getCORSConfig(env: Env): CORSConfig {
    return {
        origin: getAllowedOrigins(env),
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowHeaders: [
            'Content-Type',
            'Authorization',
            'X-Request-ID',
            'X-Session-Token',
            'X-CSRF-Token'
        ],
        exposeHeaders: [
            'X-Request-ID',
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining',
            'X-RateLimit-Reset'
        ],
        maxAge: 86400, // 24 hours
        credentials: true
    };
}