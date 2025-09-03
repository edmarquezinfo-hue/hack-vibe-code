/**
 * Authentication Middleware
 * Handles JWT validation and session management
 */

import { AuthUser } from '../../types/auth-types';
import { createLogger } from '../../logger';
import { createDatabaseService } from '../../database/database';
import { AuthService } from '../../database/services/AuthService';
import { extractToken } from '../../utils/authUtils';

const logger = createLogger('AuthMiddleware');
/**
 * Validate JWT token and return user
 */
export async function validateToken(
    token: string,
    env: Env
): Promise<AuthUser | null> {
    try {
        const validateStart = performance.now();
        
        // Create database service
        const dbStart = performance.now();
        const db = createDatabaseService(env);
        const dbEnd = performance.now();
        
        // Create auth service
        const authServiceStart = performance.now();
        const authService = new AuthService(db, env);
        const authServiceEnd = performance.now();
        
        // Validate token and get user
        const tokenValidationStart = performance.now();
        const result = await authService.validateTokenAndGetUser(token, env);
        const tokenValidationEnd = performance.now();
        
        const validateEnd = performance.now();
        
        const dbTime = dbEnd - dbStart;
        const authServiceTime = authServiceEnd - authServiceStart;
        const tokenValidationTime = tokenValidationEnd - tokenValidationStart;
        const totalTime = validateEnd - validateStart;
        
        if (totalTime > 50) {
            logger.info('Token validation timing breakdown', {
                total: `${totalTime.toFixed(2)}ms`,
                dbCreation: `${dbTime.toFixed(2)}ms`,
                authServiceCreation: `${authServiceTime.toFixed(2)}ms`,
                tokenValidation: `${tokenValidationTime.toFixed(2)}ms`
            });
        }
        
        return result;
    } catch (error) {
        logger.error('Token validation error', error);
        return null;
    }
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
        
        logger.debug('No authentication found');
        return null;
    } catch (error) {
        logger.error('Auth middleware error', error);
        return null;
    }
}