/**
 * Model Configuration Controller
 * Handles CRUD operations for user model configurations
 */

import { BaseController } from './BaseController';
import { ModelConfigService } from '../../services/modelConfig/ModelConfigService';
import { SecretsService } from '../../services/secrets/secretsService';
import { ModelTestService } from '../../services/modelConfig/ModelTestService';
import { AgentActionKey, ModelConfig, AGENT_CONFIG } from '../../agents/inferutils/config';
import { z } from 'zod';

// All valid AI model values for validation
const validAIModels = [
    // OpenAI Models
    'openai/gpt-5',
    'openai/gpt-5-mini',
    'openai/o3',
    'openai/o4-mini',
    'openai/chatgpt-4o-latest',
    'openai/gpt-4.1-2025-04-14',
    'openai/gpt-oss-120b',
    // Anthropic Models
    'anthropic/claude-3-5-sonnet-latest',
    'anthropic/claude-3-7-sonnet-20250219',
    'anthropic/claude-opus-4-20250514',
    'anthropic/claude-sonnet-4-20250514',
    // Google Models
    'google-ai-studio/gemini-2.5-pro',
    'google-ai-studio/gemini-2.5-flash',
    '[gemini]gemini-2.5-flash-lite-preview-06-17',
    'google-ai-studio/gemini-2.5-flash-preview-05-20',
    'google-ai-studio/gemini-2.5-pro-preview-05-06',
    'google-ai-studio/gemini-2.5-flash-preview-04-17',
    'google-ai-studio/gemini-2.5-pro-preview-06-05',
    'google-ai-studio/gemini-2.0-flash',
    'google-ai-studio/gemini-1.5-flash-8b-latest',
    // OpenRouter Models
    '[openrouter]qwen/qwen3-coder',
    '[openrouter]moonshotai/kimi-k2',
    // Cerebras Models
    'cerebras/gpt-oss-120b',
    'cerebras/qwen-3-coder-480b'
] as const;

// Validation schemas
const modelConfigUpdateSchema = z.object({
    modelName: z.enum(validAIModels as any).nullable().optional(),
    maxTokens: z.number().min(1).max(200000).nullable().optional(),
    temperature: z.number().min(0).max(2).nullable().optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']).nullable().optional(),
    providerOverride: z.enum(['cloudflare', 'direct']).nullable().optional(),
    fallbackModel: z.enum(validAIModels as any).nullable().optional()
});

const modelTestSchema = z.object({
    agentActionName: z.string(),
    testPrompt: z.string().optional(),
    useUserKeys: z.boolean().default(true)
});

export class ModelConfigController extends BaseController {
    private modelConfigService: ModelConfigService;
    private secretsService: SecretsService;
    private modelTestService: ModelTestService;
    private env: Env;

    constructor(env: Env) {
        super();
        this.env = env;
        const db = this.createDbService(env);
        this.modelConfigService = new ModelConfigService(db);
        this.secretsService = new SecretsService(db, env);
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

            // Convert to ModelConfig format - only include non-null values
            const modelConfig: Partial<ModelConfig> = {};
            
            if (validatedData.modelName !== null && validatedData.modelName !== undefined) {
                modelConfig.name = validatedData.modelName as any;
            }
            if (validatedData.maxTokens !== null && validatedData.maxTokens !== undefined) {
                modelConfig.max_tokens = validatedData.maxTokens;
            }
            if (validatedData.temperature !== null && validatedData.temperature !== undefined) {
                modelConfig.temperature = validatedData.temperature;
            }
            if (validatedData.reasoningEffort !== null && validatedData.reasoningEffort !== undefined) {
                modelConfig.reasoning_effort = validatedData.reasoningEffort as any;
            }
            if (validatedData.providerOverride !== null && validatedData.providerOverride !== undefined) {
                modelConfig.providerOverride = validatedData.providerOverride;
            }
            if (validatedData.fallbackModel !== null && validatedData.fallbackModel !== undefined) {
                modelConfig.fallbackModel = validatedData.fallbackModel as any;
            }

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
                userApiKeys = await this.secretsService.getUserProviderKeysMap(session.userId);
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