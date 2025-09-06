/**
 * Secrets Routes
 * API routes for user secrets management
 */

import { Router, AuthConfig } from '../router';
import { SecretsController } from '../controllers/secrets/controller';

/**
 * Setup secrets-related routes
 */
export function setupSecretsRoutes(env: Env, router: Router): void {
    const secretsController = new SecretsController(env);
    // Secrets management routes
    router.get('/api/secrets', secretsController.getAllSecrets.bind(secretsController), AuthConfig.authenticated);
    router.post('/api/secrets', secretsController.storeSecret.bind(secretsController), AuthConfig.authenticated);
    router.patch('/api/secrets/:secretId/toggle', secretsController.toggleSecret.bind(secretsController), AuthConfig.authenticated);
    router.delete('/api/secrets/:secretId', secretsController.deleteSecret.bind(secretsController), AuthConfig.authenticated);
    
    // Templates route
    router.get('/api/secrets/templates', secretsController.getTemplates.bind(secretsController), AuthConfig.authenticated);
}