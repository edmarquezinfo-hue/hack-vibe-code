/**
 * Authentication Middleware
 * Handles JWT validation and session management
 */

import { AuthUser } from '../../types/auth-types';
import { createLogger } from '../../logger';
import { createDatabaseService } from '../../database/database';
import { AuthService } from '../../database/services/AuthService';
import { extractToken, parseCookies } from '../../utils/authUtils';

const logger = createLogger('AuthMiddleware');
/**
 * Validate JWT token and return user
 */
export async function validateToken(
    token: string,
    env: Env
): Promise<AuthUser | null> {
    try {
        // Use AuthService for token validation and user retrieval
        const db = createDatabaseService(env);
        const authService = new AuthService(db, env, '');
        return authService.validateTokenAndGetUser(token, env);
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