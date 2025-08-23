/**
 * Model Configuration Routes
 * Routes for managing user model configurations
 * Provider API keys are managed via the unified secrets system
 */

import { Router, AuthConfig } from '../router';
import { ModelConfigController } from '../controllers/modelConfig/controller';

/**
 * Setup model configuration routes
 * All routes are protected and require authentication
 */
export function setupModelConfigRoutes(router: Router): Router {
    const modelConfigController = new ModelConfigController();

    // Model Configuration Routes
    router.get('/api/model-configs', modelConfigController.getModelConfigs.bind(modelConfigController), AuthConfig.authenticated);
    router.get('/api/model-configs/defaults', modelConfigController.getDefaults.bind(modelConfigController), AuthConfig.authenticated);
    router.get('/api/model-configs/byok-providers', modelConfigController.getByokProviders.bind(modelConfigController), AuthConfig.authenticated);
    router.get('/api/model-configs/:agentAction', modelConfigController.getModelConfig.bind(modelConfigController), AuthConfig.authenticated);
    router.put('/api/model-configs/:agentAction', modelConfigController.updateModelConfig.bind(modelConfigController), AuthConfig.authenticated);
    router.delete('/api/model-configs/:agentAction', modelConfigController.deleteModelConfig.bind(modelConfigController), AuthConfig.authenticated);
    router.post('/api/model-configs/test', modelConfigController.testModelConfig.bind(modelConfigController), AuthConfig.authenticated);
    router.post('/api/model-configs/reset-all', modelConfigController.resetAllConfigs.bind(modelConfigController), AuthConfig.authenticated);

    return router;
}