import { Router } from '../router';
import { appController } from '../controllers/appController';
import { appViewController } from '../controllers/appViewController';

/**
 * Setup app management routes
 */
export function setupAppRoutes(router: Router): Router {
    // Get all apps for the current user
    router.get('/api/apps', appController.getUserApps.bind(appController));

    // Get recent apps
    router.get('/api/apps/recent', appController.getRecentApps.bind(appController));

    // Get favorite apps
    router.get('/api/apps/favorites', appController.getFavoriteApps.bind(appController));

    // Get public apps feed (no auth required)
    router.get('/api/apps/public', appController.getPublicApps.bind(appController));

    // Create new app
    router.post('/api/apps', appController.createApp.bind(appController));

    // Toggle favorite status
    router.post('/api/apps/:id/favorite', appController.toggleFavorite.bind(appController));

    // Update app visibility (only for app owners)
    router.put('/api/apps/:id/visibility', appController.updateAppVisibility.bind(appController));

    // App view endpoints (public access with optional auth)
    router.get('/api/apps/:id', appViewController.getAppDetails.bind(appViewController));
    router.post('/api/apps/:id/star', appViewController.toggleAppStar.bind(appViewController));
    router.post('/api/apps/:id/fork', appViewController.forkApp.bind(appViewController));

    return router;
}