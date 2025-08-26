import { Router, AuthConfig } from '../router';
import { AppController } from '../controllers/apps/controller';
import { appViewController } from '../controllers/appView/controller';

/**
 * Setup app management routes
 */
export function setupAppRoutes(router: Router): Router {
    const appController = new AppController();
    
    // ========================================
    // PUBLIC ROUTES (Unauthenticated users can access)
    // ========================================
    
    // FIXED: Main apps listing - PUBLIC for /apps frontend route
    // This powers the main /apps page that shows all public apps
    router.get('/api/apps/public', appController.getPublicApps.bind(appController), AuthConfig.public);

    // ========================================
    // AUTHENTICATED USER ROUTES (Personal dashboard routes)
    // ========================================
    
    // Get user's personal apps - requires authentication (for dashboard/profile)
    router.get('/api/apps', appController.getUserApps.bind(appController), AuthConfig.authenticated);

    // Get recent apps - requires authentication (for dashboard)
    router.get('/api/apps/recent', appController.getRecentApps.bind(appController), AuthConfig.authenticated);

    // Get favorite apps - requires authentication (for dashboard)
    router.get('/api/apps/favorites', appController.getFavoriteApps.bind(appController), AuthConfig.authenticated);

    // ========================================
    // AUTHENTICATED INTERACTION ROUTES
    // ========================================
    
    // Star/bookmark ANY app - requires authentication (can star others' public apps)
    router.post('/api/apps/:id/star', appViewController.toggleAppStar.bind(appViewController), AuthConfig.authenticated);
    
    // Fork ANY public app - requires authentication (can fork others' public apps)
    router.post('/api/apps/:id/fork', appViewController.forkApp.bind(appViewController), AuthConfig.authenticated);

    // Toggle favorite status - requires authentication  
    router.post('/api/apps/:id/favorite', appController.toggleFavorite.bind(appController), AuthConfig.authenticated);

    // ========================================
    // PUBLIC APP DETAILS (placed after specific routes to avoid conflicts)
    // ========================================

    // App details view - PUBLIC for /app/:id frontend route  
    // Allows unauthenticated users to view and preview apps
    router.get('/api/apps/:id', appViewController.getAppDetails.bind(appViewController), AuthConfig.public);

    // ========================================
    // OWNER-ONLY ROUTES (App modification)
    // ========================================
    
    // Update app visibility - OWNER ONLY
    router.put('/api/apps/:id/visibility', appController.updateAppVisibility.bind(appController), AuthConfig.ownerOnly);

    // Delete app - OWNER ONLY
    router.delete('/api/apps/:id', appController.deleteApp.bind(appController), AuthConfig.ownerOnly);

    return router;
}
