import { drizzle } from 'drizzle-orm/d1';
import { eq, and, or, desc, count, sql, lt } from 'drizzle-orm';
import * as schema from './schema';

// Type-safe database environment interface
export interface DatabaseEnv {
    DB: D1Database;
}

// Re-export all types for convenience
export type {
    User, NewUser, Session, NewSession,
    Team, NewTeam, TeamMember, NewTeamMember,
    App, NewApp, CodeGenInstance, NewCodeGenInstance,
    Board, NewBoard, BoardMember, NewBoardMember,
    CloudflareAccount, NewCloudflareAccount,
    GitHubIntegration, NewGitHubIntegration,
    AppLike, NewAppLike, AppComment, NewAppComment,
    AppView, NewAppView, OAuthState, NewOAuthState,
    SystemSetting, NewSystemSetting
} from './schema';

/**
 * Orange Database Service - Production-ready database operations
 * 
 * Provides a clean, type-safe interface for all database operations
 * in the Orange project with proper error handling and performance optimization.
 */
export class DatabaseService {
    public readonly db: ReturnType<typeof drizzle>;

    constructor(env: DatabaseEnv) {
        this.db = drizzle(env.DB, { schema });
    }

    // ========================================
    // USER MANAGEMENT
    // ========================================

    async createUser(userData: schema.NewUser): Promise<schema.User> {
        const [user] = await this.db
            .insert(schema.users)
            .values({ ...userData, id: crypto.randomUUID() })
            .returning();
        return user;
    }

    async findUserByEmail(email: string): Promise<schema.User | null> {
        const users = await this.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.email, email))
            .limit(1);
        return users[0] || null;
    }

    async findUserById(id: string): Promise<schema.User | null> {
        const users = await this.db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, id))
            .limit(1);
        return users[0] || null;
    }

    async findUserByProvider(provider: string, providerId: string): Promise<schema.User | null> {
        const users = await this.db
            .select()
            .from(schema.users)
            .where(and(
                eq(schema.users.provider, provider),
                eq(schema.users.providerId, providerId)
            ))
            .limit(1);
        return users[0] || null;
    }

    async updateUserActivity(userId: string): Promise<void> {
        await this.db
            .update(schema.users)
            .set({ 
                lastActiveAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(schema.users.id, userId));
    }

    // ========================================
    // SESSION MANAGEMENT
    // ========================================

    async createSession(sessionData: schema.NewSession): Promise<schema.Session> {
        const [session] = await this.db
            .insert(schema.sessions)
            .values({ ...sessionData, id: crypto.randomUUID() })
            .returning();
        return session;
    }

    async findValidSession(sessionId: string): Promise<schema.Session | null> {
        const sessions = await this.db
            .select()
            .from(schema.sessions)
            .where(and(
                eq(schema.sessions.id, sessionId),
                sql`${schema.sessions.expiresAt} > CURRENT_TIMESTAMP`
            ))
            .limit(1);
        return sessions[0] || null;
    }

    async cleanupExpiredSessions(): Promise<void> {
        const now = new Date();
        await this.db
            .delete(schema.sessions)
            .where(lt(schema.sessions.expiresAt, now));
    }

    // ========================================
    // TEAM OPERATIONS
    // ========================================

    async createTeam(teamData: Omit<schema.NewTeam, 'id'>): Promise<schema.Team> {
        const [team] = await this.db
            .insert(schema.teams)
            .values({
                ...teamData,
                id: crypto.randomUUID(),
                slug: this.generateSlug(teamData.name),
            })
            .returning();

        // Add owner as team member
        await this.addTeamMember(team.id, team.ownerId, 'owner');
        return team;
    }

    async addTeamMember(teamId: string, userId: string, role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'): Promise<void> {
        await this.db
            .insert(schema.teamMembers)
            .values({
                id: crypto.randomUUID(),
                teamId,
                userId,
                role: role as 'owner' | 'admin' | 'member' | 'viewer',
                joinedAt: new Date(),
            });
    }

    async getUserTeams(userId: string): Promise<Array<schema.Team & { memberRole: string }>> {
        const results = await this.db
            .select({
                id: schema.teams.id,
                name: schema.teams.name,
                slug: schema.teams.slug,
                description: schema.teams.description,
                avatarUrl: schema.teams.avatarUrl,
                visibility: schema.teams.visibility,
                ownerId: schema.teams.ownerId,
                createdAt: schema.teams.createdAt,
                updatedAt: schema.teams.updatedAt,
                deletedAt: schema.teams.deletedAt,
                plan: schema.teams.plan,
                maxMembers: schema.teams.maxMembers,
                maxApps: schema.teams.maxApps,
                allowMemberInvites: schema.teams.allowMemberInvites,
                memberRole: schema.teamMembers.role,
            })
            .from(schema.teams)
            .innerJoin(schema.teamMembers, eq(schema.teams.id, schema.teamMembers.teamId))
            .where(and(
                eq(schema.teamMembers.userId, userId),
                eq(schema.teamMembers.status, 'active')
            ));
        return results as Array<schema.Team & { memberRole: string }>;
    }

    // ========================================
    // APP OPERATIONS
    // ========================================

    async createApp(appData: Omit<schema.NewApp, 'id'>): Promise<schema.App> {
        const [app] = await this.db
            .insert(schema.apps)
            .values({
                ...appData,
                id: crypto.randomUUID(),
                slug: appData.title ? this.generateSlug(appData.title) : undefined,
            })
            .returning();
        return app;
    }

    async getUserApps(
        userId: string,
        options: {
            teamId?: string;
            status?: string;
            visibility?: string;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<schema.App[]> {
        const { teamId, status, visibility, limit = 50, offset = 0 } = options;

        const whereConditions: any[] = [eq(schema.apps.userId, userId)];
        
        if (teamId) whereConditions.push(eq(schema.apps.teamId, teamId));
        if (status) whereConditions.push(eq(schema.apps.status, status as 'draft' | 'generating' | 'completed' | 'deployed' | 'error'));
        if (visibility) whereConditions.push(eq(schema.apps.visibility, visibility as 'private' | 'team' | 'board' | 'public'));

        const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

        return await this.db
            .select()
            .from(schema.apps)
            .where(whereClause)
            .orderBy(desc(schema.apps.updatedAt))
            .limit(limit)
            .offset(offset);
    }

    async getPublicApps(boardId?: string, limit: number = 20, offset: number = 0): Promise<schema.App[]> {
        const whereConditions: any[] = [
            or(
                eq(schema.apps.visibility, 'public'),
                eq(schema.apps.visibility, 'board')
            )
        ];

        if (boardId) {
            whereConditions.push(eq(schema.apps.boardId, boardId));
        }

        const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

        return await this.db
            .select()
            .from(schema.apps)
            .where(whereClause)
            .orderBy(desc(schema.apps.createdAt))
            .limit(limit)
            .offset(offset);
    }

    async updateAppStatus(appId: string, status: string, metadata?: any): Promise<void> {
        const updateData: any = { 
            status, 
            updatedAt: new Date() 
        };

        if (status === 'deployed' && metadata?.deploymentUrl) {
            updateData.deploymentUrl = metadata.deploymentUrl;
            updateData.lastDeployedAt = new Date();
        }

        await this.db
            .update(schema.apps)
            .set(updateData)
            .where(eq(schema.apps.id, appId));
    }

    // ========================================
    // CODE GENERATION INSTANCES
    // ========================================

    async createCodeGenInstance(instanceData: Omit<schema.NewCodeGenInstance, 'id'>): Promise<schema.CodeGenInstance> {
        const [instance] = await this.db
            .insert(schema.codeGenInstances)
            .values({ ...instanceData, id: crypto.randomUUID() })
            .returning();
        return instance;
    }

    async updateCodeGenInstance(instanceId: string, updates: Partial<schema.CodeGenInstance>): Promise<void> {
        await this.db
            .update(schema.codeGenInstances)
            .set({ ...updates, lastActivityAt: new Date() })
            .where(eq(schema.codeGenInstances.id, instanceId));
    }

    async getStaleCodeGenInstances(hoursOld: number = 24): Promise<schema.CodeGenInstance[]> {
        const cutoffTime = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
        
        return await this.db
            .select()
            .from(schema.codeGenInstances)
            .where(and(
                eq(schema.codeGenInstances.status, 'active'),
                sql`${schema.codeGenInstances.lastActivityAt} < ${cutoffTime}`
            ));
    }

    // ========================================
    // CLOUDFLARE INTEGRATION
    // ========================================

    async addCloudflareAccount(accountData: Omit<schema.NewCloudflareAccount, 'id'>): Promise<schema.CloudflareAccount> {
        const [account] = await this.db
            .insert(schema.cloudflareAccounts)
            .values({ ...accountData, id: crypto.randomUUID() })
            .returning();
        return account;
    }

    async getCloudflareAccounts(userId?: string, teamId?: string): Promise<schema.CloudflareAccount[]> {
        const whereConditions: any[] = [eq(schema.cloudflareAccounts.isActive, true)];

        if (userId && teamId) {
            whereConditions.push(
                or(
                    eq(schema.cloudflareAccounts.userId, userId),
                    eq(schema.cloudflareAccounts.teamId, teamId)
                )
            );
        } else if (userId) {
            whereConditions.push(eq(schema.cloudflareAccounts.userId, userId));
        } else if (teamId) {
            whereConditions.push(eq(schema.cloudflareAccounts.teamId, teamId));
        }

        const whereClause = whereConditions.length > 1 ? and(...whereConditions) : whereConditions[0];

        return await this.db
            .select()
            .from(schema.cloudflareAccounts)
            .where(whereClause)
            .orderBy(desc(schema.cloudflareAccounts.isDefault));
    }

    // ========================================
    // BOARD AND COMMUNITY OPERATIONS
    // ========================================

    async createBoard(boardData: Omit<schema.NewBoard, 'id'>): Promise<schema.Board> {
        const [board] = await this.db
            .insert(schema.boards)
            .values({
                ...boardData,
                id: crypto.randomUUID(),
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
            .orderBy(desc(sql`popularityScore`))
            .limit(limit);
    }

    // ========================================
    // ANALYTICS AND TRACKING
    // ========================================

    async recordAppView(viewData: Omit<schema.NewAppView, 'id'>): Promise<void> {
        // Just record the view - no need to update denormalized counters
        await this.db
            .insert(schema.appViews)
            .values({ ...viewData, id: crypto.randomUUID() });
    }

    async getAppAnalytics(appId: string, days: number = 30): Promise<{
        views: number;
        likes: number;
        period: string;
    }> {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [viewsResult] = await this.db
            .select({ count: count() })
            .from(schema.appViews)
            .where(and(
                eq(schema.appViews.appId, appId),
                sql`${schema.appViews.viewedAt} >= ${cutoffDate}`
            ));

        const [likesResult] = await this.db
            .select({ count: count() })
            .from(schema.appLikes)
            .where(eq(schema.appLikes.appId, appId));

        return {
            views: viewsResult?.count || 0,
            likes: likesResult?.count || 0,
            period: `${days} days`,
        };
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

    async getHealthStatus(): Promise<{ healthy: boolean; timestamp: string }> {
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
