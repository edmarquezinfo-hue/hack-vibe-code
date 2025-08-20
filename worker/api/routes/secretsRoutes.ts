/**
 * Secrets Routes
 * API routes for user secrets management
 */

import { Router } from '../router';
import { SecretsController } from '../controllers/secrets/controller';

/**
 * Setup secrets-related routes
 */
export function setupSecretsRoutes(router: Router): void {
    const secretsController = new SecretsController();
    // Secrets management routes
    router.get('/api/secrets', secretsController.getSecrets.bind(secretsController));
    router.post('/api/secrets', secretsController.storeSecret.bind(secretsController));
    router.delete('/api/secrets/:secretId', secretsController.deleteSecret.bind(secretsController));
    
    // Templates route
    router.get('/api/secrets/templates', secretsController.getTemplates.bind(secretsController));
}