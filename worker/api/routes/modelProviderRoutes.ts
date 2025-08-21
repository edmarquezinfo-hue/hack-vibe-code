/**
 * Model Provider Routes
 * Routes for custom model provider management
 */

import type { Router } from '../router';
import { ModelProvidersController } from '../controllers/modelProviders/controller';

export function setupModelProviderRoutes(router: Router): void {
    const controller = new ModelProvidersController();

    // Custom model provider routes
    router.get('/api/user/providers', controller.getProviders.bind(controller));
    router.get('/api/user/providers/:id', controller.getProvider.bind(controller));
    router.post('/api/user/providers', controller.createProvider.bind(controller));
    router.put('/api/user/providers/:id', controller.updateProvider.bind(controller));
    router.delete('/api/user/providers/:id', controller.deleteProvider.bind(controller));
    router.post('/api/user/providers/test', controller.testProvider.bind(controller));
}