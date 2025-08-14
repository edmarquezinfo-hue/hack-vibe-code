/**
 * Model Configuration Routes
 * Routes for managing user model configurations and provider API keys
 */

import { Router } from '../router';
import { ModelConfigController } from '../controllers/modelConfigController';
import { ProviderKeysController } from '../controllers/providerKeysController';

/**
 * Setup model configuration routes
 * All routes are protected and require authentication
 */
export function setupModelConfigRoutes(router: Router): Router {
    // Create controller handlers that capture env
    const createModelConfigHandler = (method: keyof ModelConfigController) => {
        return async (request: Request, env: Env, _ctx: ExecutionContext) => {
            const controller = new ModelConfigController(env);
            return controller[method](request);
        };
    };

    const createProviderKeysHandler = (method: keyof ProviderKeysController) => {
        return async (request: Request, env: Env, _ctx: ExecutionContext) => {
            const controller = new ProviderKeysController(env);
            return controller[method](request);
        };
    };

    // Model Configuration Routes
    router.get('/api/model-configs', createModelConfigHandler('getModelConfigs'));
    router.get('/api/model-configs/defaults', createModelConfigHandler('getDefaults'));
    router.get('/api/model-configs/:agentAction', createModelConfigHandler('getModelConfig'));
    router.put('/api/model-configs/:agentAction', createModelConfigHandler('updateModelConfig'));
    router.delete('/api/model-configs/:agentAction', createModelConfigHandler('deleteModelConfig'));
    router.post('/api/model-configs/test', createModelConfigHandler('testModelConfig'));
    router.post('/api/model-configs/reset-all', createModelConfigHandler('resetAllConfigs'));

    // Provider Keys Routes
    router.get('/api/provider-keys', createProviderKeysHandler('getProviderKeys'));
    router.get('/api/provider-keys/providers', createProviderKeysHandler('getProviders'));
    router.put('/api/provider-keys/:provider', createProviderKeysHandler('setProviderKey'));
    router.delete('/api/provider-keys/:provider', createProviderKeysHandler('deleteProviderKey'));
    router.post('/api/provider-keys/:provider/test', createProviderKeysHandler('testProviderKey'));

    return router;
}