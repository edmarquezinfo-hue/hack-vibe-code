/**
 * Authentication Middleware for Cloudflare Workers
 * Handles JWT validation and session management
 */

import { AuthUser } from '../../types/auth-types';
import { SecurityError, SecurityErrorType } from '../../types/security';
import { createLogger } from '../../logger';
import { DatabaseService } from '../../database/database';
import * as schema from '../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { TokenValidator } from '../../services/auth/tokenValidator';
import { extractToken, parseCookies } from '../../utils/authUtils';

const logger = createLogger('AuthMiddleware');

// Token extraction and cookie parsing functions moved to utils/authUtils.ts

/**
 * Validate JWT token and return user
 */
export async function validateToken(
    token: string,
    env: Env
): Promise<AuthUser | null> {
    try {
        // Use TokenValidator to avoid circular dependencies
        const tokenValidator = new TokenValidator(env);
        
        // Verify token
        const payload = await tokenValidator.verifyToken(token);
        
        if (!payload || payload.type !== 'access') {
            return null;
        }
        
        // Check if token is expired
        if (payload.exp * 1000 < Date.now()) {
            logger.debug('Token expired', { exp: payload.exp });
            return null;
        }
        
        // Get user from database
        const dbService = new DatabaseService({ DB: env.DB });
        const user = await dbService.db
            .select({
                id: schema.users.id,
                email: schema.users.email,
                displayName: schema.users.displayName
            })
            .from(schema.users)
            .where(
                and(
                    eq(schema.users.id, payload.sub),
                    sql`${schema.users.deletedAt} IS NULL`
                )
            )
            .get();
        
        if (!user) {
            logger.warn('User not found for valid token', { userId: payload.sub });
            return null;
        }
        
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName || undefined,
            isAnonymous: false
        };
    } catch (error) {
        logger.error('Token validation error', error);
        return null;
    }
}

/**
 * Check for anonymous session
 */
export async function validateAnonymousSession(
    request: Request,
    _env: Env
): Promise<AuthUser | null> {
    // Get anonymous session token from header or cookie
    const anonToken = request.headers.get('X-Anonymous-Token') || 
                                     parseCookies(request.headers.get('Cookie') || '')['anon_session'];
    
    if (!anonToken) {
        return null;
    }
    
    // For now, accept any valid UUID as anonymous session
    // In production, you might want to track these in a sessions table
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(anonToken)) {
        return null;
    }
    
    return {
        id: `anon_${anonToken}`,
        email: `${anonToken}@anonymous.local`,
        isAnonymous: true
    };
}

/**
 * Authentication middleware
 */
export async function authMiddleware(
    request: Request,
    env: Env
): Promise<AuthUser | null> {
    try {
        // Extract token
        const token = extractToken(request);
        
        if (token) {
            const user = await validateToken(token, env);
            if (user) {
                logger.debug('User authenticated', { userId: user.id });
                return user;
            }
        }
        
        // Check for anonymous session
        const anonUser = await validateAnonymousSession(request, env);
        if (anonUser) {
            logger.debug('Anonymous user authenticated', { userId: anonUser.id });
            return anonUser;
        }
        
        logger.debug('No authentication found');
        return null;
    } catch (error) {
        logger.error('Auth middleware error', error);
        return null;
    }
}

/**
 * Require authentication middleware
 */
export async function requireAuth(
    request: Request,
    env: Env
): Promise<AuthUser> {
    const user = await authMiddleware(request, env);
    
    if (!user) {
        throw new SecurityError(
            SecurityErrorType.UNAUTHORIZED,
            'Authentication required',
            401
        );
    }
    
    return user;
}

/**
 * Check if user has required permissions
 */
export async function checkPermissions(
    user: AuthUser,
    requiredScopes: string[],
    _env: Env
): Promise<boolean> {
    // For now, all authenticated users have all scopes
    // In production, implement proper RBAC
    if (user.isAnonymous && requiredScopes.includes('codegen:write')) {
        // Anonymous users can use code generation
        return true;
    }
    
    return !user.isAnonymous;
}

// Cookie management functions moved to utils/authUtils.ts

// Re-export for backward compatibility
export { clearAuthCookie } from '../../utils/authUtils';