/**
 * Core Database Service
 * Provides database connection, core utilities, and base operations
 * Domain-specific operations have been moved to dedicated services
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq , sql } from 'drizzle-orm';
import * as schema from './schema';
import { generateId } from '../utils/idGenerator';

// Import centralized types
import type { HealthStatusResult } from './types';

// ========================================
// TYPE DEFINITIONS AND INTERFACES
// ========================================

// Type-safe database environment interface
export interface DatabaseEnv {
    DB: D1Database;
}

// Re-export all types for convenience
export type {
    User, NewUser, Session, NewSession,
    Team, NewTeam, TeamMember, NewTeamMember,
    App, NewApp,
    Board, NewBoard, BoardMember, NewBoardMember,
    CloudflareAccount, NewCloudflareAccount,
    GitHubIntegration, NewGitHubIntegration,
    AppLike, NewAppLike, AppComment, NewAppComment,
    AppView, NewAppView, OAuthState, NewOAuthState,
    SystemSetting, NewSystemSetting,
    UserSecret, NewUserSecret,
    UserModelConfig, NewUserModelConfig,
    UserProviderKey, NewUserProviderKey
} from './schema';

/**
 * Core Database Service - Connection and Base Operations
 * 
 * Provides database connection, shared utilities, and core operations.
 * Domain-specific operations are handled by dedicated service classes.
 */
export class DatabaseService {
    public readonly db: ReturnType<typeof drizzle>;

    constructor(env: DatabaseEnv) {
        this.db = drizzle(env.DB, { schema });
    }
    // ========================================
    // CLOUDFLARE INTEGRATION (Core Operations)
    // ========================================

    async addCloudflareAccount(accountData: Omit<schema.NewCloudflareAccount, 'id'>): Promise<schema.CloudflareAccount> {
        const [account] = await this.db
            .insert(schema.cloudflareAccounts)
            .values({ ...accountData, id: generateId() })
            .returning();
        return account;
    }

    // ========================================
    // BOARD AND COMMUNITY OPERATIONS (Core Operations)
    // ========================================

    async createBoard(boardData: Omit<schema.NewBoard, 'id'>): Promise<schema.Board> {
        const [board] = await this.db
            .insert(schema.boards)
            .values({
                ...boardData,
                id: generateId(),
                slug: this.generateSlug(boardData.name),
            })
            .returning();
        return board;
    }

    async getPopularBoards(limit: number = 10): Promise<schema.Board[]> {
        // Use SQL aggregation for optimal performance - single query with joins
        return await this.db
            .select({
                id: schema.boards.id,
                name: schema.boards.name,
                slug: schema.boards.slug,
                description: schema.boards.description,
                iconUrl: schema.boards.iconUrl,
                bannerUrl: schema.boards.bannerUrl,
                visibility: schema.boards.visibility,
                allowSubmissions: schema.boards.allowSubmissions,
                requireApproval: schema.boards.requireApproval,
                rules: schema.boards.rules,
                guidelines: schema.boards.guidelines,
                ownerId: schema.boards.ownerId,
                teamId: schema.boards.teamId,
                createdAt: schema.boards.createdAt,
                updatedAt: schema.boards.updatedAt,
                // Calculated fields
                memberCount: sql<number>`COALESCE((
                    SELECT COUNT(*) 
                    FROM ${schema.boardMembers} 
                    WHERE ${schema.boardMembers.boardId} = ${schema.boards.id} 
                    AND ${schema.boardMembers.isBanned} = false
                ), 0)`,
                appCount: sql<number>`COALESCE((
                    SELECT COUNT(*) 
                    FROM ${schema.apps} 
                    WHERE ${schema.apps.boardId} = ${schema.boards.id} 
                    AND ${schema.apps.visibility} = 'board'
                ), 0)`,
                // Popularity score: apps weighted 3x, members 1x
                popularityScore: sql<number>`COALESCE((
                    SELECT COUNT(*) 
                    FROM ${schema.apps} 
                    WHERE ${schema.apps.boardId} = ${schema.boards.id} 
                    AND ${schema.apps.visibility} = 'board'
                ), 0) * 3 + COALESCE((
                    SELECT COUNT(*) 
                    FROM ${schema.boardMembers} 
                    WHERE ${schema.boardMembers.boardId} = ${schema.boards.id} 
                    AND ${schema.boardMembers.isBanned} = false
                ), 0)`
            })
            .from(schema.boards)
            .where(eq(schema.boards.visibility, 'public'))
            .orderBy(sql`popularityScore DESC`)
            .limit(limit);
    }

    // ========================================
    // GITHUB INTEGRATION OPERATIONS (Core Operations)
    // ========================================

    /**
     * Get GitHub integration for a user with proper typing
     * Returns formatted data ready for API response
     */
    async getGitHubIntegration(userId: string): Promise<schema.GitHubIntegration | null> {
        const integration = await this.db
            .select()
            .from(schema.githubIntegrations)
            .where(eq(schema.githubIntegrations.userId, userId))
            .get();

        return integration || null;
    }

    /**
     * Upsert GitHub integration with validation and proper error handling
     * Handles both create and update operations efficiently
     */
    async upsertGitHubIntegration(
        userId: string,
        githubData: {
            githubUserId: string;
            githubUsername: string;
            accessToken: string;
            refreshToken?: string;
            scopes: string[];
        }
    ): Promise<schema.GitHubIntegration> {
        // Input validation
        if (!userId?.trim()) {
            throw new Error('User ID is required');
        }
        
        // Validate GitHub user ID format (must be numeric)
        if (!/^\d+$/.test(githubData.githubUserId)) {
            throw new Error('Invalid GitHub user ID format');
        }
        
        // Sanitize GitHub username (remove potentially dangerous characters)
        const sanitizedUsername = githubData.githubUsername
            .replace(/[<>"'&]/g, '')
            .trim();
        
        if (!sanitizedUsername || sanitizedUsername.length > 39) { // GitHub max username length
            throw new Error('Invalid GitHub username');
        }
        
        // Basic access token validation
        if (!githubData.accessToken || typeof githubData.accessToken !== 'string') {
            throw new Error('Invalid GitHub access token format');
        }

        // Check if integration already exists
        const existing = await this.db
            .select()
            .from(schema.githubIntegrations)
            .where(eq(schema.githubIntegrations.userId, userId))
            .get();

        const integrationData = {
            githubUserId: githubData.githubUserId,
            githubUsername: sanitizedUsername,
            accessTokenHash: githubData.accessToken,
            refreshTokenHash: githubData.refreshToken || null,
            scopes: JSON.stringify(githubData.scopes),
            isActive: true,
            lastValidated: new Date(),
            updatedAt: new Date()
        };

        if (existing) {
            // Update existing integration
            const [updated] = await this.db
                .update(schema.githubIntegrations)
                .set(integrationData)
                .where(eq(schema.githubIntegrations.userId, userId))
                .returning();
            
            return updated;
        } else {
            // Create new integration
            const [created] = await this.db
                .insert(schema.githubIntegrations)
                .values({
                    ...integrationData,
                    id: generateId(),
                    userId,
                    createdAt: new Date()
                })
                .returning();

            return created;
        }
    }

    /**
     * Deactivate GitHub integration (soft delete)
     * Follows existing database service patterns
     */
    async deactivateGitHubIntegration(userId: string): Promise<void> {
        await this.db
            .update(schema.githubIntegrations)
            .set({
                isActive: false,
                updatedAt: new Date()
            })
            .where(eq(schema.githubIntegrations.userId, userId));
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    private generateSlug(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
            .substring(0, 50);
    }

    async getHealthStatus(): Promise<HealthStatusResult> {
        try {
            await this.db.select().from(schema.systemSettings).limit(1);
            return {
                healthy: true,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                healthy: false,
                timestamp: new Date().toISOString(),
            };
        }
    }
}

/**
 * Factory function to create database service instance
 */
export function createDatabaseService(env: DatabaseEnv): DatabaseService {
    return new DatabaseService(env);
}

/**
 * Get database connection with schema
 */
export function getDatabase(env: DatabaseEnv) {
    return drizzle(env.DB, { schema });
}