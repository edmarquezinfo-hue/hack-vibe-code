/**
 * GitHub Exporter Routes
 * Handles GitHub repository export flows
 */

import { Router, AuthConfig } from '../router';
import { GitHubExporterController } from '../controllers/githubExporter/controller';

/**
 * Setup GitHub Exporter routes
 */
export function setupGitHubExporterRoutes(env: Env, router: Router): void {
    const githubExporterController = new GitHubExporterController(env);
    router.get('/api/github-exporter/callback', githubExporterController.handleOAuthCallback.bind(githubExporterController), AuthConfig.public);
    
    // Repository export routes with OAuth flow
    router.post('/api/github-app/export', githubExporterController.initiateGitHubExport.bind(githubExporterController), AuthConfig.authenticated);
}
