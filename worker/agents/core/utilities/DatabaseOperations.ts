import { DatabaseService } from '../../../database/database';
import * as schema from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { StructuredLogger } from '../../../logger';

/**
 * Utility class for common database operations to reduce code duplication
 */
export class DatabaseOperations {
    /**
     * Update app record in database with consistent error handling
     */
    static async updateApp(
        env: { DB?: D1Database },
        sessionId: string,
        logger: StructuredLogger,
        updates: Partial<typeof schema.apps.$inferInsert>
    ): Promise<boolean> {
        if (!env.DB || !sessionId) {
            return false;
        }

        try {
            const dbService = new DatabaseService({ DB: env.DB });
            await dbService.db
                .update(schema.apps)
                .set({ 
                    ...updates, 
                    updatedAt: new Date() 
                })
                .where(eq(schema.apps.id, sessionId));
            
            logger.info('Updated app in database', { 
                sessionId, 
                updateFields: Object.keys(updates)
            });
            return true;
        } catch (error) {
            logger.error('Failed to update app in database', {
                error: error instanceof Error ? error.message : String(error),
                sessionId,
                updateFields: Object.keys(updates)
            });
            return false;
        }
    }

    /**
     * Update app with deployment URL
     */
    static async updateDeploymentUrl(
        env: { DB?: D1Database },
        sessionId: string,
        logger: StructuredLogger,
        deploymentUrl: string,
        status: 'deployed' | 'completed' = 'deployed'
    ): Promise<boolean> {
        return this.updateApp(env, sessionId, logger, {
            deploymentUrl,
            deploymentStatus: status,
            status,
        });
    }

    /**
     * Update app with GitHub repository URL
     */
    static async updateGitHubRepository(
        env: { DB?: D1Database },
        sessionId: string,
        logger: StructuredLogger,
        repositoryUrl: string,
        existingMetadata: Record<string, any> = {}
    ): Promise<boolean> {
        return this.updateApp(env, sessionId, logger, {
            deploymentMetadata: JSON.stringify({
                ...existingMetadata,
                githubRepository: repositoryUrl
            })
        });
    }
}