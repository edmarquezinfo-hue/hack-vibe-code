/**
 * Background Session Cleanup Service
 * Handles cleanup of expired sessions without blocking user requests
 */

import { DatabaseService } from '../../database/database';
import * as schema from '../../database/schema';
import { lt } from 'drizzle-orm';
import { createLogger } from '../../logger';

const logger = createLogger('SessionCleanupService');

export class SessionCleanupService {
    private cleanupInterval: number = 3600000; // 1 hour
    private isRunning: boolean = false;
    
    constructor(private db: DatabaseService) {}

    /**
     * Start background cleanup process
     */
    startCleanup(): void {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.scheduleNextCleanup();
        logger.info('Session cleanup service started');
    }

    /**
     * Stop background cleanup process
     */
    stopCleanup(): void {
        this.isRunning = false;
        logger.info('Session cleanup service stopped');
    }

    /**
     * Schedule next cleanup cycle
     */
    private scheduleNextCleanup(): void {
        if (!this.isRunning) return;
        
        setTimeout(async () => {
            try {
                await this.performCleanup();
            } catch (error) {
                logger.error('Error during session cleanup', error);
            }
            
            // Schedule next cleanup if still running
            if (this.isRunning) {
                this.scheduleNextCleanup();
            }
        }, this.cleanupInterval);
    }

    /**
     * Perform comprehensive cleanup
     */
    private async performCleanup(): Promise<void> {
        const startTime = Date.now();
        logger.info('Starting session cleanup');

        try {
            // Clean up expired sessions
            const expiredSessionsCleanup = await this.cleanupExpiredSessions();
            
            // Clean up expired OAuth states
            const expiredOAuthCleanup = await this.cleanupExpiredOAuthStates();
            
            // Clean up expired password reset tokens
            const expiredPasswordResetCleanup = await this.cleanupExpiredPasswordResetTokens();
            
            // Clean up expired email verification tokens
            const expiredEmailVerificationCleanup = await this.cleanupExpiredEmailVerificationTokens();
            
            // Clean up old auth attempts (keep last 30 days)
            const oldAuthAttemptsCleanup = await this.cleanupOldAuthAttempts();

            const duration = Date.now() - startTime;
            logger.info('Session cleanup completed', {
                duration,
                expiredSessions: expiredSessionsCleanup,
                expiredOAuthStates: expiredOAuthCleanup,
                expiredPasswordResetTokens: expiredPasswordResetCleanup,
                expiredEmailVerificationTokens: expiredEmailVerificationCleanup,
                oldAuthAttempts: oldAuthAttemptsCleanup
            });
        } catch (error) {
            logger.error('Error during cleanup', error);
        }
    }

    /**
     * Clean up expired sessions
     */
    private async cleanupExpiredSessions(): Promise<number> {
        const now = new Date();
        
        try {
            const result = await this.db.db
                .delete(schema.sessions)
                .where(lt(schema.sessions.expiresAt, now));
            
            return result.meta.changes || 0;
        } catch (error) {
            logger.error('Error cleaning up expired sessions', error);
            return 0;
        }
    }

    /**
     * Clean up expired OAuth states
     */
    private async cleanupExpiredOAuthStates(): Promise<number> {
        const now = new Date();
        
        try {
            const result = await this.db.db
                .delete(schema.oauthStates)
                .where(lt(schema.oauthStates.expiresAt, now));
            
            return result.meta.changes || 0;
        } catch (error) {
            logger.error('Error cleaning up expired OAuth states', error);
            return 0;
        }
    }

    /**
     * Clean up expired password reset tokens
     */
    private async cleanupExpiredPasswordResetTokens(): Promise<number> {
        const now = new Date();
        
        try {
            const result = await this.db.db
                .delete(schema.passwordResetTokens)
                .where(lt(schema.passwordResetTokens.expiresAt, now));
            
            return result.meta.changes || 0;
        } catch (error) {
            logger.error('Error cleaning up expired password reset tokens', error);
            return 0;
        }
    }

    /**
     * Clean up expired email verification tokens
     */
    private async cleanupExpiredEmailVerificationTokens(): Promise<number> {
        const now = new Date();
        
        try {
            const result = await this.db.db
                .delete(schema.emailVerificationTokens)
                .where(lt(schema.emailVerificationTokens.expiresAt, now));
            
            return result.meta.changes || 0;
        } catch (error) {
            logger.error('Error cleaning up expired email verification tokens', error);
            return 0;
        }
    }

    /**
     * Clean up old auth attempts (keep last 30 days)
     */
    private async cleanupOldAuthAttempts(): Promise<number> {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        try {
            const result = await this.db.db
                .delete(schema.authAttempts)
                .where(lt(schema.authAttempts.attemptedAt, thirtyDaysAgo));
            
            return result.meta.changes || 0;
        } catch (error) {
            logger.error('Error cleaning up old auth attempts', error);
            return 0;
        }
    }

    /**
     * Force cleanup (for manual triggers)
     */
    async forceCleanup(): Promise<void> {
        await this.performCleanup();
    }
}