/**
 * Integration Routes
 * Handles third-party integrations like GitHub
 */

import { Router } from '../router';
import { GitHubIntegrationController } from '../controllers/githubIntegrationController';

/**
 * Setup integration-related routes
 */
export function setupIntegrationRoutes(router: Router): void {
    // GitHub integration routes
    router.get('/api/integrations/github/status', GitHubIntegrationController.getIntegrationStatus);
    router.get('/api/integrations/github/connect', GitHubIntegrationController.initiateIntegration);
    router.delete('/api/integrations/github', GitHubIntegrationController.removeIntegration);
}