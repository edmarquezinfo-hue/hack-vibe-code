import { Router } from '../router';
import { StatsController } from '../controllers/statsController';

/**
 * Setup user statistics routes
 */
export function setupStatsRoutes(router: Router): Router {
    const statsController = new StatsController();

    // User statistics
    router.get('/api/stats', statsController.getUserStats.bind(statsController));
    
    // User activity timeline
    router.get('/api/stats/activity', statsController.getUserActivity.bind(statsController));

    return router;
}