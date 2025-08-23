/**
 * Model Provider Routes
 * Routes for custom model provider management
 */

import type { Router } from '../router';
import { AuthConfig } from '../router';
import { ModelProvidersController } from '../controllers/modelProviders/controller';

export function setupModelProviderRoutes(router: Router): void {
    const controller = new ModelProvidersController();

    // Custom model provider routes
    router.get('/api/user/providers', controller.getProviders.bind(controller), AuthConfig.authenticated);
    router.get('/api/user/providers/:id', controller.getProvider.bind(controller), AuthConfig.authenticated);
    router.post('/api/user/providers', controller.createProvider.bind(controller), AuthConfig.authenticated);
    router.put('/api/user/providers/:id', controller.updateProvider.bind(controller), AuthConfig.authenticated);
    router.delete('/api/user/providers/:id', controller.deleteProvider.bind(controller), AuthConfig.authenticated);
    router.post('/api/user/providers/test', controller.testProvider.bind(controller), AuthConfig.authenticated);
}