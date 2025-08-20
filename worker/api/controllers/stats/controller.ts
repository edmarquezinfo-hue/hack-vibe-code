
import { BaseController } from '../BaseController';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { UserStatsData, UserActivityData } from './types';
import { AnalyticsService } from '../../../database/services/AnalyticsService';

export class StatsController extends BaseController {
    constructor() {
        super();
    }
    // Get user statistics
    async getUserStats(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<UserStatsData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<UserStatsData>>;
            }

            const dbService = this.createDbService(env);
            const analyticsService = new AnalyticsService(dbService);

            // Get comprehensive user statistics using analytics service
            const enhancedStats = await analyticsService.getEnhancedUserStats(authResult.user!.id);

            // Use EnhancedUserStats directly as response data
            const responseData = enhancedStats;

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching user stats:', error);
            return this.createErrorResponse<UserStatsData>('Failed to fetch user statistics', 500);
        }
    }


    // Get user activity timeline
    async getUserActivity(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<UserActivityData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<UserActivityData>>;
            }

            const dbService = this.createDbService(env);
            const analyticsService = new AnalyticsService(dbService);

            // Get user activity timeline using analytics service
            const activities = await analyticsService.getUserActivityTimeline(authResult.user!.id, 20);

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