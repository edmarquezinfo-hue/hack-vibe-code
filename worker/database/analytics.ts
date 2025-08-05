/**
 * Analytics and Count Queries Service
 * Provides optimized count queries to replace denormalized count fields
 * Maintains 3NF compliance while achieving optimal performance through proper indexing
 */

import { DatabaseService } from './database';
import * as schema from './schema';
import { eq, count, sql, and } from 'drizzle-orm';

export class AnalyticsService {
    constructor(private db: DatabaseService) {}

    /**
     * Get team statistics with optimized queries
     */
    async getTeamStats(teamId: string) {
        const [memberCount, appCount] = await Promise.all([
            // Count active team members
            this.db.db
                .select({ count: count() })
                .from(schema.teamMembers)
                .where(
                    and(
                        eq(schema.teamMembers.teamId, teamId),
                        eq(schema.teamMembers.status, 'active')
                    )
                )
                .get(),
            
            // Count team apps
            this.db.db
                .select({ count: count() })
                .from(schema.apps)
                .where(eq(schema.apps.teamId, teamId))
                .get()
        ]);

        return {
            memberCount: memberCount?.count ?? 0,
            appCount: appCount?.count ?? 0
        };
    }

    /**
     * Get board statistics with optimized queries
     */
    async getBoardStats(boardId: string) {
        const [memberCount, appCount] = await Promise.all([
            // Count board members
            this.db.db
                .select({ count: count() })
                .from(schema.boardMembers)
                .where(
                    and(
                        eq(schema.boardMembers.boardId, boardId),
                        eq(schema.boardMembers.isBanned, false)
                    )
                )
                .get(),
            
            // Count apps shared to board
            this.db.db
                .select({ count: count() })
                .from(schema.apps)
                .where(
                    and(
                        eq(schema.apps.boardId, boardId),
                        eq(schema.apps.visibility, 'board')
                    )
                )
                .get()
        ]);

        return {
            memberCount: memberCount?.count ?? 0,
            appCount: appCount?.count ?? 0
        };
    }

    /**
     * Get app statistics with optimized queries
     */
    async getAppStats(appId: string) {
        const [viewCount, forkCount, likeCount] = await Promise.all([
            // Count unique views (by user or session)
            this.db.db
                .select({ count: count() })
                .from(schema.appViews)
                .where(eq(schema.appViews.appId, appId))
                .get(),
            
            // Count forks (apps with this as parent)
            this.db.db
                .select({ count: count() })
                .from(schema.apps)
                .where(eq(schema.apps.parentAppId, appId))
                .get(),
            
            // Count likes/stars
            this.db.db
                .select({ count: count() })
                .from(schema.appLikes)
                .where(eq(schema.appLikes.appId, appId))
                .get()
        ]);

        return {
            viewCount: viewCount?.count ?? 0,
            forkCount: forkCount?.count ?? 0,
            likeCount: likeCount?.count ?? 0
        };
    }

    /**
     * Get comment statistics with optimized queries
     */
    async getCommentStats(commentId: string) {
        const [likeCount, replyCount] = await Promise.all([
            // Count comment likes
            this.db.db
                .select({ count: count() })
                .from(schema.commentLikes)
                .where(eq(schema.commentLikes.commentId, commentId))
                .get(),
            
            // Count replies
            this.db.db
                .select({ count: count() })
                .from(schema.appComments)
                .where(
                    and(
                        eq(schema.appComments.parentCommentId, commentId),
                        eq(schema.appComments.isDeleted, false)
                    )
                )
                .get()
        ]);

        return {
            likeCount: likeCount?.count ?? 0,
            replyCount: replyCount?.count ?? 0
        };
    }

    /**
     * Batch get statistics for multiple entities
     * More efficient when loading lists of items
     */
    async batchGetAppStats(appIds: string[]) {
        if (appIds.length === 0) return {};

        // Get all stats in parallel using batch queries
        const [views, forks, likes] = await Promise.all([
            // Batch view counts
            this.db.db
                .select({
                    appId: schema.appViews.appId,
                    count: count()
                })
                .from(schema.appViews)
                .where(sql`${schema.appViews.appId} IN ${appIds}`)
                .groupBy(schema.appViews.appId)
                .all(),
            
            // Batch fork counts
            this.db.db
                .select({
                    parentAppId: schema.apps.parentAppId,
                    count: count()
                })
                .from(schema.apps)
                .where(sql`${schema.apps.parentAppId} IN ${appIds}`)
                .groupBy(schema.apps.parentAppId)
                .all(),
            
            // Batch like counts
            this.db.db
                .select({
                    appId: schema.appLikes.appId,
                    count: count()
                })
                .from(schema.appLikes)
                .where(sql`${schema.appLikes.appId} IN ${appIds}`)
                .groupBy(schema.appLikes.appId)
                .all()
        ]);

        // Combine results into lookup object
        const result: Record<string, { viewCount: number; forkCount: number; likeCount: number }> = {};
        
        appIds.forEach(appId => {
            result[appId] = {
                viewCount: views.find(v => v.appId === appId)?.count ?? 0,
                forkCount: forks.find(f => f.parentAppId === appId)?.count ?? 0,
                likeCount: likes.find(l => l.appId === appId)?.count ?? 0
            };
        });

        return result;
    }

    /**
     * Get user statistics
     */
    async getUserStats(userId: string) {
        const [appCount, teamCount, favoriteCount] = await Promise.all([
            // Count user's apps
            this.db.db
                .select({ count: count() })
                .from(schema.apps)
                .where(eq(schema.apps.userId, userId))
                .get(),
            
            // Count teams user belongs to
            this.db.db
                .select({ count: count() })
                .from(schema.teamMembers)
                .where(
                    and(
                        eq(schema.teamMembers.userId, userId),
                        eq(schema.teamMembers.status, 'active')
                    )
                )
                .get(),
            
            // Count favorites
            this.db.db
                .select({ count: count() })
                .from(schema.favorites)
                .where(eq(schema.favorites.userId, userId))
                .get()
        ]);

        return {
            appCount: appCount?.count ?? 0,
            teamCount: teamCount?.count ?? 0,
            favoriteCount: favoriteCount?.count ?? 0
        };
    }
}