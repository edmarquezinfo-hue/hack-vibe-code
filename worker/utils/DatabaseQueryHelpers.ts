/**
 * Database Query Helpers
 * Consolidates common database query patterns to eliminate duplication
 */

import { DatabaseService } from '../database/database';
import * as schema from '../database/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { createLogger } from '../logger';

const logger = createLogger('DatabaseQueryHelpers');

/**
 * Common database query patterns and utilities
 */
export class DatabaseQueryHelpers {
    
    /**
     * Find a user-owned resource by ID
     * Prevents unauthorized access by ensuring the resource belongs to the user
     */
    static async findUserOwnedResource<T = Record<string, unknown>>(
        dbService: DatabaseService,
        table: unknown,
        resourceId: string,
        userId: string,
        resourceIdField: string = 'id',
        userIdField: string = 'userId'
    ): Promise<T[]> {
        try {
            const tableRef = table as any;
            return await dbService.db
                .select()
                .from(tableRef)
                .where(and(
                    eq(tableRef[resourceIdField], resourceId),
                    eq(tableRef[userIdField], userId)
                ))
                .limit(1);
        } catch (error) {
            logger.error('Error finding user-owned resource', { 
                resourceId, 
                userId, 
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Get paginated results from a query
     */
    static async getPaginatedResults<T>(
        query: unknown,
        page: number = 1,
        limit: number = 10
    ): Promise<{ data: T[]; total: number; page: number; limit: number }> {
        try {
            const offset = (page - 1) * limit;
            const queryRef = query as any;
            
            // Execute paginated query
            const data = await queryRef
                .limit(limit)
                .offset(offset);

            // Get total count (simplified - in production you might want to optimize this)
            const totalResults = await queryRef;
            const total = Array.isArray(totalResults) ? totalResults.length : 0;

            return {
                data,
                total,
                page,
                limit
            };
        } catch (error) {
            logger.error('Error getting paginated results', {
                page,
                limit,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Cleanup expired records from a table
     */
    static async cleanupExpiredRecords(
        dbService: DatabaseService,
        table: unknown,
        expirationField: string = 'expiresAt'
    ): Promise<number> {
        try {
            const now = new Date();
            const tableRef = table as any;
            const result = await dbService.db
                .delete(tableRef)
                .where(lt(tableRef[expirationField], now));

            const deletedCount = result.meta?.changes || 0;
            
            logger.info('Cleaned up expired records', {
                deletedCount,
                expirationField
            });

            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up expired records', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Find user by email with case-insensitive matching
     */
    static async findUserByEmail(
        dbService: DatabaseService,
        email: string
    ): Promise<Record<string, unknown> | null> {
        try {
            const users = await dbService.db
                .select()
                .from(schema.users)
                .where(eq(schema.users.email, email.toLowerCase()))
                .limit(1);

            return users.length > 0 ? users[0] : null;
        } catch (error) {
            logger.error('Error finding user by email', {
                email: email.toLowerCase(),
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Get user's active sessions
     */
    static async getUserActiveSessions(
        dbService: DatabaseService,
        userId: string
    ): Promise<Record<string, unknown>[]> {
        try {
            return await dbService.db
                .select()
                .from(schema.sessions)
                .where(eq(schema.sessions.userId, userId))
                .orderBy(desc(schema.sessions.lastActivity));
        } catch (error) {
            logger.error('Error getting user active sessions', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Get user's API keys
     */
    static async getUserApiKeys(
        dbService: DatabaseService,
        userId: string,
        activeOnly: boolean = false
    ): Promise<Record<string, unknown>[]> {
        try {
            const whereConditions = [eq(schema.apiKeys.userId, userId)];
            
            if (activeOnly) {
                whereConditions.push(eq(schema.apiKeys.isActive, true));
            }

            return await dbService.db
                .select({
                    id: schema.apiKeys.id,
                    name: schema.apiKeys.name,
                    keyPreview: schema.apiKeys.keyPreview,
                    createdAt: schema.apiKeys.createdAt,
                    lastUsed: schema.apiKeys.lastUsed,
                    isActive: schema.apiKeys.isActive
                })
                .from(schema.apiKeys)
                .where(and(...whereConditions))
                .orderBy(desc(schema.apiKeys.createdAt));
        } catch (error) {
            logger.error('Error getting user API keys', {
                userId,
                activeOnly,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Update resource with ownership check
     */
    static async updateUserOwnedResource(
        dbService: DatabaseService,
        table: unknown,
        resourceId: string,
        userId: string,
        updateData: Record<string, unknown>,
        resourceIdField: string = 'id',
        userIdField: string = 'userId'
    ): Promise<boolean> {
        try {
            const tableRef = table as any;
            const result = await dbService.db
                .update(tableRef)
                .set({
                    ...updateData,
                    updatedAt: new Date()
                })
                .where(and(
                    eq(tableRef[resourceIdField], resourceId),
                    eq(tableRef[userIdField], userId)
                ));

            const wasUpdated = (result.meta?.changes || 0) > 0;
            
            if (!wasUpdated) {
                logger.warn('Attempted to update non-existent or unauthorized resource', {
                    resourceId,
                    userId
                });
            }

            return wasUpdated;
        } catch (error) {
            logger.error('Error updating user-owned resource', {
                resourceId,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Deactivate resource (soft delete)
     */
    static async deactivateResource(
        dbService: DatabaseService,
        table: unknown,
        resourceId: string,
        userId?: string,
        resourceIdField: string = 'id',
        userIdField: string = 'userId'
    ): Promise<boolean> {
        try {
            const tableRef = table as any;
            const whereConditions = [eq(tableRef[resourceIdField], resourceId)];
            
            if (userId) {
                whereConditions.push(eq(tableRef[userIdField], userId));
            }

            const result = await dbService.db
                .update(tableRef)
                .set({
                    isActive: false,
                    updatedAt: new Date()
                })
                .where(and(...whereConditions));

            return (result.meta?.changes || 0) > 0;
        } catch (error) {
            logger.error('Error deactivating resource', {
                resourceId,
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Count user-owned resources
     */
    static async countUserOwnedResources(
        dbService: DatabaseService,
        table: unknown,
        userId: string,
        userIdField: string = 'userId',
        additionalConditions?: unknown[]
    ): Promise<number> {
        try {
            const tableRef = table as any;
            const whereConditions = [eq(tableRef[userIdField], userId)];
            
            if (additionalConditions) {
                whereConditions.push(...(additionalConditions as any[]));
            }

            const results = await dbService.db
                .select()
                .from(tableRef)
                .where(and(...whereConditions));

            return results.length;
        } catch (error) {
            logger.error('Error counting user-owned resources', {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Create database service instance (utility method)
     */
    static createDbService(env: Env): DatabaseService {
        return new DatabaseService({ DB: env.DB });
    }

    /**
     * Execute database operation with error handling
     */
    static async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        operationName: string,
        context?: Record<string, any>
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            logger.error(`Database operation failed: ${operationName}`, {
                ...context,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
}