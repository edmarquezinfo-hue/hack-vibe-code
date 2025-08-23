
import { BaseController } from '../BaseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { UserStatsData, UserActivityData } from './types';
import { AnalyticsService } from '../../../database/services/AnalyticsService';

export class StatsController extends BaseController {
    constructor() {
        super();
    }
    // Get user statistics
    async getUserStats(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<UserStatsData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<UserStatsData>('Authentication required', 401);
            }

            const dbService = this.createDbService(env);
            const analyticsService = new AnalyticsService(dbService);

            // Get comprehensive user statistics using analytics service
            const enhancedStats = await analyticsService.getEnhancedUserStats(user.id);

            // Use EnhancedUserStats directly as response data
            const responseData = enhancedStats;

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching user stats:', error);
            return this.createErrorResponse<UserStatsData>('Failed to fetch user statistics', 500);
        }
    }


    // Get user activity timeline
    async getUserActivity(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<UserActivityData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<UserActivityData>('Authentication required', 401);
            }

            const dbService = this.createDbService(env);
            const analyticsService = new AnalyticsService(dbService);

            // Get user activity timeline using analytics service
            const activities = await analyticsService.getUserActivityTimeline(user.id, 20);

            const responseData: UserActivityData = { activities };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching user activity:', error);
            return this.createErrorResponse<UserActivityData>('Failed to fetch user activity', 500);
        }
    }
}

// Export singleton instance
export const statsController = new StatsController();