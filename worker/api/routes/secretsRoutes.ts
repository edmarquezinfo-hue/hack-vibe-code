/**
 * Secrets Routes
 * API routes for user secrets management
 */

import { Router } from '../router';
import { SecretsController } from '../controllers/secretsController';

/**
 * Create a protected handler for secrets endpoints
 */
function createSecretsHandler(method: keyof SecretsController) {
    return async (request: Request, env: Env): Promise<Response> => {
        const controller = new SecretsController(env);
        return await controller[method](request);
    };
}

/**
 * Setup secrets-related routes
 */
export function setupSecretsRoutes(router: Router): void {
    // Secrets management routes
    router.get('/api/secrets', createSecretsHandler('getSecrets'));
    router.post('/api/secrets', createSecretsHandler('storeSecret'));
    router.delete('/api/secrets/:secretId', createSecretsHandler('deleteSecret'));
    
    // Templates route
    router.get('/api/secrets/templates', createSecretsHandler('getTemplates'));
}