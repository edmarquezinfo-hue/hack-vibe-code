/**
 * Integration Routes
 * Handles third-party integrations like GitHub
 */

import { Router } from '../router';
import { GitHubIntegrationController } from '../controllers/githubIntegration/controller';

/**
 * Setup integration-related routes
 */
export function setupIntegrationRoutes(router: Router): void {
    // Export singleton instance
    const githubIntegrationController = new GitHubIntegrationController();
    // GitHub integration routes
    router.get('/api/integrations/github/status', githubIntegrationController.getIntegrationStatus.bind(githubIntegrationController));
    router.get('/api/integrations/github/connect', githubIntegrationController.initiateIntegration.bind(githubIntegrationController));
    router.delete('/api/integrations/github', githubIntegrationController.removeIntegration.bind(githubIntegrationController));
}