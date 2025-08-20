import { Router } from '../router';
import { UserController } from '../controllers/user/controller';

/**
 * Setup user management routes
 */
export function setupUserRoutes(router: Router): Router {
    const userController = new UserController();

    // User dashboard
    router.get('/api/user/dashboard', userController.getDashboard.bind(userController));

    // User apps with pagination (this is what the frontend needs)
    router.get('/api/user/apps', userController.getApps.bind(userController));

    // User profile and teams
    router.put('/api/user/profile', userController.updateProfile.bind(userController));
    router.get('/api/user/teams', userController.getTeams.bind(userController));
    
    // Agent session creation
    router.post('/api/user/agent-session', userController.createAgentSession.bind(userController));

    return router;
}