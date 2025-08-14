/**
 * Model Configuration Routes
 * Routes for managing user model configurations
 * Provider API keys are managed via the unified secrets system
 */

import { Router } from '../router';
import { ModelConfigController } from '../controllers/modelConfigController';

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


    // Model Configuration Routes
    router.get('/api/model-configs', createModelConfigHandler('getModelConfigs'));
    router.get('/api/model-configs/defaults', createModelConfigHandler('getDefaults'));
    router.get('/api/model-configs/:agentAction', createModelConfigHandler('getModelConfig'));
    router.put('/api/model-configs/:agentAction', createModelConfigHandler('updateModelConfig'));
    router.delete('/api/model-configs/:agentAction', createModelConfigHandler('deleteModelConfig'));
    router.post('/api/model-configs/test', createModelConfigHandler('testModelConfig'));
    router.post('/api/model-configs/reset-all', createModelConfigHandler('resetAllConfigs'));

    return router;
}