/**
 * CSRF Protection Service
 * Implements double-submit cookie pattern for CSRF protection
 */

import { createLogger } from '../../logger';
import { SecurityError, SecurityErrorType } from '../../types/security';
import { generateSecureToken } from '../../utils/cryptoUtils';
import { parseCookies, createSecureCookie } from '../../utils/authUtils';

const logger = createLogger('CsrfService');

export class CsrfService {
    private static readonly COOKIE_NAME = 'csrf-token';
    private static readonly HEADER_NAME = 'X-CSRF-Token';
    
    /**
     * Generate a cryptographically secure CSRF token
     */
    static generateToken(): string {
        return generateSecureToken(32);
    }
    
    /**
     * Set CSRF token cookie
     */
    static setTokenCookie(response: Response, token: string): void {
        const cookie = createSecureCookie({
            name: this.COOKIE_NAME,
            value: token,
            sameSite: 'Strict',
            maxAge: 86400 // 24 hours
        });
        response.headers.append('Set-Cookie', cookie);
    }
    
    /**
     * Extract CSRF token from cookies
     */
    static getTokenFromCookie(request: Request): string | null {
        const cookieHeader = request.headers.get('Cookie');
        if (!cookieHeader) return null;
        
        const cookies = parseCookies(cookieHeader);
        return cookies[this.COOKIE_NAME] || null;
    }
    
    /**
     * Extract CSRF token from request header
     */
    static getTokenFromHeader(request: Request): string | null {
        return request.headers.get(this.HEADER_NAME);
    }
    
    /**
     * Validate CSRF token (double-submit cookie pattern)
     */
    static validateToken(request: Request): boolean {
        const method = request.method.toUpperCase();
        
        // Skip validation for safe methods
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return true;
        }
        
        // Skip for WebSocket upgrades
        const upgradeHeader = request.headers.get('upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
            return true;
        }
        
        const cookieToken = this.getTokenFromCookie(request);
        const headerToken = this.getTokenFromHeader(request);
        
        // Both tokens must exist and match
        if (!cookieToken || !headerToken) {
            logger.warn('CSRF validation failed: missing token', {
                hasCookie: !!cookieToken,
                hasHeader: !!headerToken,
                path: new URL(request.url).pathname
            });
            return false;
        }
        
        if (cookieToken !== headerToken) {
            logger.warn('CSRF validation failed: token mismatch', {
                path: new URL(request.url).pathname
            });
            return false;
        }
        
        return true;
    }
    
    /**
     * Middleware to enforce CSRF protection
     */
    static async enforce(request: Request): Promise<void> {
        // Validate token for state-changing requests
        if (!this.validateToken(request)) {
            throw new SecurityError(
                SecurityErrorType.CSRF_VIOLATION,
                'CSRF token validation failed',
                403
            );
        }
    }
    
    /**
     * Get or generate CSRF token for a request
     */
    static getOrGenerateToken(request: Request): string {
        const existingToken = this.getTokenFromCookie(request);
        return existingToken || this.generateToken();
    }
}
