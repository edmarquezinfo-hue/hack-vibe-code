import { Router, AuthConfig } from '../router';
import { StatsController } from '../controllers/stats/controller';

/**
 * Setup user statistics routes
 */
export function setupStatsRoutes(router: Router): Router {
    const statsController = new StatsController();

    // User statistics
    router.get('/api/stats', statsController.getUserStats.bind(statsController), AuthConfig.authenticated);
    
    // User activity timeline
    router.get('/api/stats/activity', statsController.getUserActivity.bind(statsController), AuthConfig.authenticated);

    return router;
}