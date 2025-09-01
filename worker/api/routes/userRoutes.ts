import { Router, AuthConfig } from '../router';
import { UserController } from '../controllers/user/controller';

/**
 * Setup user management routes
 */
export function setupUserRoutes(env: Env, router: Router): Router {
    const userController = new UserController(env);

    // User apps with pagination (this is what the frontend needs)
    router.get('/api/user/apps', userController.getApps.bind(userController), AuthConfig.authenticated);

    // User profile and teams
    router.put('/api/user/profile', userController.updateProfile.bind(userController), AuthConfig.authenticated);
    
    return router;
}