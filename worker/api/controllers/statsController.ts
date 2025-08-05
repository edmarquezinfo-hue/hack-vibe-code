import * as schema from '../../database/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { BaseController } from './BaseController';
import { DatabaseService } from '../../database/database';

export class StatsController extends BaseController {
    constructor() {
        super();
    }
    // Get user statistics
    async getUserStats(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const dbService = this.createDbService(env);

            // Get total apps count
            const totalAppsResult = await dbService.db
                .select({ count: sql<number>`count(*)` })
                .from(schema.apps)
                .where(eq(schema.apps.userId, authResult.user!.id));

            // Get public apps count
            const publicAppsResult = await dbService.db
                .select({ count: sql<number>`count(*)` })
                .from(schema.apps)
                .where(and(
                    eq(schema.apps.userId, authResult.user!.id),
                    eq(schema.apps.visibility, 'public')
                ));

            // Get favorites count (apps favorited by others)
            const totalLikesResult = await dbService.db
                .select({ count: sql<number>`count(*)` })
                .from(schema.favorites)
                .innerJoin(schema.apps, eq(schema.favorites.appId, schema.apps.id))
                .where(eq(schema.apps.userId, authResult.user!.id));

            // Get user's favorite count
            const userFavoritesResult = await dbService.db
                .select({ count: sql<number>`count(*)` })
                .from(schema.favorites)
                .where(eq(schema.favorites.userId, authResult.user!.id));

            // Get teams count (when implemented)
            const teamsCount = 0; // TODO: Implement when teams table is added

            // Get boards count (when implemented)
            const boardsCount = 0; // TODO: Implement when boards table is added

            // Calculate streak (days of consecutive activity)
            const streakDays = await this.calculateStreak(dbService, authResult.user!.id);

            return this.createSuccessResponse({
                totalApps: totalAppsResult[0]?.count || 0,
                publicApps: publicAppsResult[0]?.count || 0,
                totalViews: 0, // TODO: Implement view tracking
                totalLikes: totalLikesResult[0]?.count || 0,
                favoriteCount: userFavoritesResult[0]?.count || 0,
                teamCount: teamsCount,
                boardCount: boardsCount,
                streak: streakDays,
                achievements: [] // TODO: Implement achievements system
            });
        } catch (error) {
            return this.handleError(error, 'fetch user stats');
        }
    }

    // Calculate consecutive days of activity
    private async calculateStreak(dbService: DatabaseService, userId: string): Promise<number> {
        try {
            // Get apps created/updated by date
            const activities = await dbService.db
                .select({
                    date: sql<string>`DATE(${schema.apps.updatedAt})`
                })
                .from(schema.apps)
                .where(eq(schema.apps.userId, userId))
                .orderBy(desc(schema.apps.updatedAt))
                .groupBy(sql`DATE(${schema.apps.updatedAt})`);

            if (activities.length === 0) return 0;

            let streak = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Check if there's activity today or yesterday
            const lastActivity = new Date(activities[0].date);
            const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff > 1) return 0; // Streak broken

            // Count consecutive days
            let currentDate = new Date(lastActivity);
            for (const activity of activities) {
                const activityDate = new Date(activity.date);
                const diff = Math.floor((currentDate.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (diff <= 1) {
                    streak++;
                    currentDate = activityDate;
                } else {
                    break; // Streak broken
                }
            }

            return streak;
        } catch (error) {
            console.error('Error calculating streak:', error);
            return 0;
        }
    }

    // Get user activity timeline
    async getUserActivity(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response!;
            }

            const dbService = this.createDbService(env);

            // Get recent app creations and updates
            const recentActivity = await dbService.db
                .select({
                    id: schema.apps.id,
                    title: schema.apps.title,
                    action: sql<string>`CASE WHEN ${schema.apps.createdAt} = ${schema.apps.updatedAt} THEN 'created' ELSE 'updated' END`,
                    timestamp: schema.apps.updatedAt,
                    framework: schema.apps.framework
                })
                .from(schema.apps)
                .where(eq(schema.apps.userId, authResult.user!.id))
                .orderBy(desc(schema.apps.updatedAt))
                .limit(20);

            // Get recent favorites
            const recentFavorites = await dbService.db
                .select({
                    appId: schema.favorites.appId,
                    appTitle: schema.apps.title,
                    timestamp: schema.favorites.createdAt
                })
                .from(schema.favorites)
                .innerJoin(schema.apps, eq(schema.favorites.appId, schema.apps.id))
                .where(eq(schema.favorites.userId, authResult.user!.id))
                .orderBy(desc(schema.favorites.createdAt))
                .limit(10);

            return this.createSuccessResponse({
                activities: [
                    ...recentActivity.map(a => ({
                        type: a.action,
                        title: a.title,
                        timestamp: a.timestamp,
                        metadata: { framework: a.framework }
                    })),
                    ...recentFavorites.map(f => ({
                        type: 'favorited',
                        title: f.appTitle,
                        timestamp: f.timestamp,
                        metadata: { appId: f.appId }
                    }))
                ].sort((a, b) => {
                    const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                    const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                    return dateB - dateA;
                })
            });
        } catch (error) {
            return this.handleError(error, 'fetch user activity');
        }
    }
}