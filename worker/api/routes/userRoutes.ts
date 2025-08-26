import { Router, AuthConfig } from '../router';
import { UserController } from '../controllers/user/controller';

/**
 * Setup user management routes
 */
export function setupUserRoutes(router: Router): Router {
    const userController = new UserController();

    // User dashboard
    router.get('/api/user/dashboard', userController.getDashboard.bind(userController), AuthConfig.authenticated);

    // User apps with pagination (this is what the frontend needs)
    router.get('/api/user/apps', userController.getApps.bind(userController), AuthConfig.authenticated);

    // User profile and teams
    router.put('/api/user/profile', userController.updateProfile.bind(userController), AuthConfig.authenticated);
    router.get('/api/user/teams', userController.getTeams.bind(userController), AuthConfig.authenticated);
    
    return router;
}