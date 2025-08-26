/**
 * Analytics Routes
 * Setup routes for AI Gateway analytics endpoints
 */

import { Router, AuthConfig } from '../router';
import { AnalyticsController } from '../controllers/analytics/controller';

/**
 * Setup analytics routes
 */
export function setupAnalyticsRoutes(router: Router): Router {
    const analyticsController = new AnalyticsController();

    // User analytics - requires authentication
    router.get(
        '/api/user/:id/analytics',
        analyticsController.getUserAnalytics.bind(analyticsController),
        AuthConfig.authenticated
    );

    // Agent/Chat analytics - requires authentication
    router.get(
        '/api/agent/:id/analytics',
        analyticsController.getAgentAnalytics.bind(analyticsController),
        AuthConfig.authenticated
    );

    return router;
}