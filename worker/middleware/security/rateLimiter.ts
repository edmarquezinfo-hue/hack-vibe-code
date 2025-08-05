/**
 * Rate Limiting Middleware using Durable Objects
 * Prevents brute force attacks and API abuse
 */

import { SecurityError, SecurityErrorType } from '../../types/security';
import { createLogger } from '../../logger';

const logger = createLogger('RateLimiter');

export interface RateLimitConfig {
    requests: number;
    window: number; // milliseconds
    identifier: (request: Request) => string;
}

export class RateLimiter {
    private attempts: Map<string, number[]> = new Map();
    
    constructor(private config: RateLimitConfig) {}

    async checkLimit(request: Request): Promise<boolean> {
        const identifier = this.config.identifier(request);
        const now = Date.now();
        
        // Get existing attempts
        const userAttempts = this.attempts.get(identifier) || [];
        
        // Clean expired attempts
        const validAttempts = userAttempts.filter(
            attempt => now - attempt < this.config.window
        );
        
        // Check if limit exceeded
        if (validAttempts.length >= this.config.requests) {
            logger.warn('Rate limit exceeded', { 
                identifier, 
                attempts: validAttempts.length,
                limit: this.config.requests 
            });
            return false;
        }
        
        // Record this attempt
        validAttempts.push(now);
        this.attempts.set(identifier, validAttempts);
        
        return true;
    }

    async getRemainingAttempts(request: Request): Promise<number> {
        const identifier = this.config.identifier(request);
        const now = Date.now();
        const userAttempts = this.attempts.get(identifier) || [];
        
        const validAttempts = userAttempts.filter(
            attempt => now - attempt < this.config.window
        );
        
        return Math.max(0, this.config.requests - validAttempts.length);
    }
}

// Predefined rate limit configurations
export const authRateLimit = new RateLimiter({
    requests: 5,
    window: 15 * 60 * 1000, // 15 minutes
    identifier: (request: Request) => {
        const ip = request.headers.get('CF-Connecting-IP') || 
                             request.headers.get('X-Forwarded-For')?.split(',')[0] || 
                             'unknown';
        return `auth:${ip}`;
    }
});

export const apiRateLimit = new RateLimiter({
    requests: 100,
    window: 60 * 1000, // 1 minute
    identifier: (request: Request) => {
        const ip = request.headers.get('CF-Connecting-IP') || 
                             request.headers.get('X-Forwarded-For')?.split(',')[0] || 
                             'unknown';
        return `api:${ip}`;
    }
});

export async function rateLimitMiddleware(
    request: Request,
    rateLimiter: RateLimiter
): Promise<void> {
    const allowed = await rateLimiter.checkLimit(request);
    
    if (!allowed) {
        throw new SecurityError(
            SecurityErrorType.RATE_LIMITED,
            `Rate limit exceeded. Try again later.`,
            429
        );
    }
}