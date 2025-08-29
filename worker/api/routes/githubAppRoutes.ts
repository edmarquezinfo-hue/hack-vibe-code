/**
 * GitHub App Routes
 * Handles GitHub App installation and export flows
 */

import { Router, AuthConfig } from '../router';
import { GitHubAppController } from '../controllers/githubApp/controller';

/**
 * Setup GitHub App routes
 */
export function setupGitHubAppRoutes(router: Router): void {
    const githubAppController = new GitHubAppController();
    router.get('/api/github-app/oauth-callback', githubAppController.handleOAuthCallback.bind(githubAppController), AuthConfig.public);
    
    // Repository export routes with OAuth flow
    router.post('/api/github-app/export', githubAppController.initiateGitHubExport.bind(githubAppController), AuthConfig.authenticated);
}
