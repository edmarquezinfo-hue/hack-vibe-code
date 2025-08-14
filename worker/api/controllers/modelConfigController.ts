/**
 * Model Configuration Controller
 * Handles CRUD operations for user model configurations
 */

import { BaseController } from './BaseController';
import { ModelConfigService } from '../../services/modelConfig/ModelConfigService';
import { ProviderKeyService } from '../../services/modelConfig/ProviderKeyService';
import { ModelTestService } from '../../services/modelConfig/ModelTestService';
import { AgentActionKey, ModelConfig, AGENT_CONFIG } from '../../agents/inferutils/config';
import { z } from 'zod';

// Validation schemas
const modelConfigUpdateSchema = z.object({
    modelName: z.string().optional(),
    maxTokens: z.number().min(1).max(200000).optional(),
    temperature: z.number().min(0).max(2).optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    providerOverride: z.enum(['cloudflare', 'direct']).optional(),
    fallbackModel: z.string().optional()
});

const modelTestSchema = z.object({
    agentActionName: z.string(),
    testPrompt: z.string().optional(),
    useUserKeys: z.boolean().default(true)
});

export class ModelConfigController extends BaseController {
    private modelConfigService: ModelConfigService;
    private providerKeyService: ProviderKeyService;
    private modelTestService: ModelTestService;
    private env: Env;

    constructor(env: Env) {
        super();
        this.env = env;
        const db = this.createDbService(env);
        this.modelConfigService = new ModelConfigService(db);
        this.providerKeyService = new ProviderKeyService(db, env);
        this.modelTestService = new ModelTestService(env);
    }

    /**
     * Get all model configurations for the current user
     * GET /api/model-configs
     */
    async getModelConfigs(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const configs = await this.modelConfigService.getUserModelConfigs(session.userId);
            const defaults = this.modelConfigService.getDefaultConfigs();

            return this.createSuccessResponse({
                configs,
                defaults,
                message: 'Model configurations retrieved successfully'
            });
        } catch (error) {
            return this.handleError(error, 'get model configurations');
        }
    }

    /**
     * Get a specific model configuration
     * GET /api/model-configs/:agentAction
     */
    async getModelConfig(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const url = new URL(request.url);
            const agentAction = url.pathname.split('/').pop() as AgentActionKey;

            if (!agentAction || !(agentAction in AGENT_CONFIG)) {
                return this.createErrorResponse('Invalid agent action name', 400);
            }

            const config = await this.modelConfigService.getUserModelConfig(session.userId, agentAction);
            const defaultConfig = this.modelConfigService.getDefaultConfigs()[agentAction];

            return this.createSuccessResponse({
                config,
                defaultConfig,
                message: 'Model configuration retrieved successfully'
            });
        } catch (error) {
            return this.handleError(error, 'get model configuration');
        }
    }

    /**
     * Update a specific model configuration
     * PUT /api/model-configs/:agentAction
     */
    async updateModelConfig(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const url = new URL(request.url);
            const agentAction = url.pathname.split('/').pop() as AgentActionKey;

            if (!agentAction || !(agentAction in AGENT_CONFIG)) {
                return this.createErrorResponse('Invalid agent action name', 400);
            }

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const validatedData = modelConfigUpdateSchema.parse(bodyResult.data);

            // Convert to ModelConfig format
            const modelConfig: Partial<ModelConfig> = {
                ...(validatedData.modelName && { name: validatedData.modelName as any }),
                ...(validatedData.maxTokens && { max_tokens: validatedData.maxTokens }),
                ...(validatedData.temperature !== undefined && { temperature: validatedData.temperature }),
                ...(validatedData.reasoningEffort && { reasoning_effort: validatedData.reasoningEffort as any }),
                ...(validatedData.providerOverride && { providerOverride: validatedData.providerOverride }),
                ...(validatedData.fallbackModel && { fallbackModel: validatedData.fallbackModel as any })
            };

            const updatedConfig = await this.modelConfigService.upsertUserModelConfig(
                session.userId,
                agentAction,
                modelConfig
            );

            return this.createSuccessResponse({
                config: updatedConfig,
                message: 'Model configuration updated successfully'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return this.createErrorResponse('Validation failed: ' + JSON.stringify(error.errors), 400);
            }
            return this.handleError(error, 'update model configuration');
        }
    }

    /**
     * Delete/reset a model configuration to default
     * DELETE /api/model-configs/:agentAction
     */
    async deleteModelConfig(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const url = new URL(request.url);
            const agentAction = url.pathname.split('/').pop() as AgentActionKey;

            if (!agentAction || !(agentAction in AGENT_CONFIG)) {
                return this.createErrorResponse('Invalid agent action name', 400);
            }

            const deleted = await this.modelConfigService.deleteUserModelConfig(session.userId, agentAction);

            if (!deleted) {
                return this.createErrorResponse('Configuration not found or already using defaults', 404);
            }

            return this.createSuccessResponse({
                message: 'Model configuration reset to default successfully'
            });
        } catch (error) {
            return this.handleError(error, 'delete model configuration');
        }
    }

    /**
     * Test a model configuration
     * POST /api/model-configs/test
     */
    async testModelConfig(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const validatedData = modelTestSchema.parse(bodyResult.data);
            const agentAction = validatedData.agentActionName as AgentActionKey;

            if (!(agentAction in AGENT_CONFIG)) {
                return this.createErrorResponse('Invalid agent action name', 400);
            }

            // Get the user's configuration for this agent action
            const userConfig = await this.modelConfigService.getUserModelConfig(session.userId, agentAction);

            // Get user API keys if requested
            let userApiKeys: Map<string, string> | undefined;
            if (validatedData.useUserKeys) {
                userApiKeys = await this.providerKeyService.getUserProviderKeysMap(session.userId);
            }

            // Test the configuration
            const testResult = await this.modelTestService.testModelConfig({
                modelConfig: userConfig,
                userApiKeys,
                testPrompt: validatedData.testPrompt
            });

            return this.createSuccessResponse({
                testResult,
                message: testResult.success 
                    ? 'Model configuration test successful' 
                    : 'Model configuration test failed'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return this.createErrorResponse('Validation failed: ' + JSON.stringify(error.errors), 400);
            }
            return this.handleError(error, 'test model configuration');
        }
    }

    /**
     * Reset all model configurations to defaults
     * POST /api/model-configs/reset-all
     */
    async resetAllConfigs(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const resetCount = await this.modelConfigService.resetAllUserConfigs(session.userId);

            return this.createSuccessResponse({
                resetCount,
                message: `${resetCount} model configurations reset to defaults`
            });
        } catch (error) {
            return this.handleError(error, 'reset all model configurations');
        }
    }

    /**
     * Get default configurations
     * GET /api/model-configs/defaults
     */
    async getDefaults(_request: Request): Promise<Response> {
        try {
            const defaults = this.modelConfigService.getDefaultConfigs();
            
            return this.createSuccessResponse({
                defaults,
                message: 'Default configurations retrieved successfully'
            });
        } catch (error) {
            return this.handleError(error, 'get default configurations');
        }
    }
}