/**
 * Provider Keys Controller
 * Handles CRUD operations for user provider API keys
 */

import { BaseController } from './BaseController';
import { ProviderKeyService } from '../../services/modelConfig/ProviderKeyService';
import { ModelTestService } from '../../services/modelConfig/ModelTestService';
import { z } from 'zod';

// Validation schemas
const setProviderKeySchema = z.object({
    apiKey: z.string().min(1, 'API key is required')
});

const testProviderKeySchema = z.object({
    apiKey: z.string().optional() // Optional - will use stored key if not provided
});

// Common provider names mapping
const PROVIDER_ALIASES: Record<string, string> = {
    'openai': 'openai',
    'anthropic': 'anthropic', 
    'claude': 'anthropic',
    'gemini': 'google-ai-studio',
    'google-ai-studio': 'google-ai-studio',
    'google': 'google-ai-studio',
    'openrouter': 'openrouter',
    'cerebras': 'cerebras'
};

export class ProviderKeysController extends BaseController {
    private providerKeyService: ProviderKeyService;
    private modelTestService: ModelTestService;
    private env: Env;

    constructor(env: Env) {
        super();
        this.env = env;
        const db = this.createDbService(env);
        this.providerKeyService = new ProviderKeyService(db, env);
        this.modelTestService = new ModelTestService(env);
    }

    /**
     * Get all provider keys for the current user
     * GET /api/provider-keys
     */
    async getProviderKeys(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const keys = await this.providerKeyService.getUserProviderKeys(session.userId);

            return this.createSuccessResponse({
                keys,
                providers: Object.keys(PROVIDER_ALIASES),
                message: 'Provider keys retrieved successfully'
            });
        } catch (error) {
            return this.handleError(error, 'get provider keys');
        }
    }

    /**
     * Set or update a provider API key
     * PUT /api/provider-keys/:provider
     */
    async setProviderKey(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const url = new URL(request.url);
            const provider = url.pathname.split('/').pop();

            if (!provider) {
                return this.createErrorResponse('Provider name is required', 400);
            }

            // Normalize provider name
            const normalizedProvider = PROVIDER_ALIASES[provider.toLowerCase()] || provider.toLowerCase();

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const validatedData = setProviderKeySchema.parse(bodyResult.data);

            const updatedKey = await this.providerKeyService.setProviderKey(
                session.userId,
                normalizedProvider,
                validatedData.apiKey
            );

            return this.createSuccessResponse({
                key: {
                    id: updatedKey.id,
                    provider: updatedKey.provider,
                    keyPreview: updatedKey.keyPreview,
                    testStatus: updatedKey.testStatus,
                    isActive: updatedKey.isActive,
                    createdAt: updatedKey.createdAt,
                    updatedAt: updatedKey.updatedAt
                },
                message: 'Provider API key updated successfully'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return this.createErrorResponse('Validation failed: ' + JSON.stringify(error.errors), 400);
            }
            return this.handleError(error, 'set provider key');
        }
    }

    /**
     * Delete a provider API key
     * DELETE /api/provider-keys/:provider
     */
    async deleteProviderKey(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const url = new URL(request.url);
            const provider = url.pathname.split('/').pop();

            if (!provider) {
                return this.createErrorResponse('Provider name is required', 400);
            }

            // Normalize provider name
            const normalizedProvider = PROVIDER_ALIASES[provider.toLowerCase()] || provider.toLowerCase();

            const deleted = await this.providerKeyService.deleteProviderKey(session.userId, normalizedProvider);

            if (!deleted) {
                return this.createErrorResponse('Provider key not found', 404);
            }

            return this.createSuccessResponse({
                message: 'Provider API key deleted successfully'
            });
        } catch (error) {
            return this.handleError(error, 'delete provider key');
        }
    }

    /**
     * Test a provider API key
     * POST /api/provider-keys/:provider/test
     */
    async testProviderKey(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const url = new URL(request.url);
            const pathParts = url.pathname.split('/');
            const provider = pathParts[pathParts.length - 2]; // Get provider from path (before /test)

            if (!provider) {
                return this.createErrorResponse('Provider name is required', 400);
            }

            // Normalize provider name
            const normalizedProvider = PROVIDER_ALIASES[provider.toLowerCase()] || provider.toLowerCase();

            const bodyResult = await this.parseJsonBody(request);
            if (!bodyResult.success) {
                return bodyResult.response!;
            }

            const validatedData = testProviderKeySchema.parse(bodyResult.data);

            let apiKey = validatedData.apiKey;
            
            // If no API key provided in request, get from stored keys
            if (!apiKey) {
                const key = await this.providerKeyService.getDecryptedApiKey(session.userId, normalizedProvider);
                if (!key) {
                    return this.createErrorResponse('No API key found for this provider', 404);
                }
                apiKey = key;
            }

            // Test the key
            const testResult = await this.modelTestService.testProviderKey(normalizedProvider, apiKey);

            // Update test status in database if using stored key
            if (!validatedData.apiKey) {
                await this.providerKeyService.updateTestStatus(session.userId, normalizedProvider, testResult);
            }

            return this.createSuccessResponse({
                testResult,
                message: testResult.success 
                    ? 'Provider API key test successful' 
                    : 'Provider API key test failed'
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return this.createErrorResponse('Validation failed: ' + JSON.stringify(error.errors), 400);
            }
            return this.handleError(error, 'test provider key');
        }
    }

    /**
     * Get supported providers list
     * GET /api/provider-keys/providers
     */
    async getProviders(_request: Request): Promise<Response> {
        try {
            const providers = Object.entries(PROVIDER_ALIASES).map(([alias, canonical]) => ({
                alias,
                canonical,
                displayName: this.getProviderDisplayName(canonical),
                icon: this.getProviderIcon(canonical),
                description: this.getProviderDescription(canonical)
            }));

            return this.createSuccessResponse({
                providers,
                message: 'Supported providers retrieved successfully'
            });
        } catch (error) {
            return this.handleError(error, 'get providers');
        }
    }

    /**
     * Get display name for a provider
     */
    private getProviderDisplayName(provider: string): string {
        const displayNames: Record<string, string> = {
            'openai': 'OpenAI',
            'anthropic': 'Anthropic (Claude)',
            'google-ai-studio': 'Google AI Studio (Gemini)',
            'openrouter': 'OpenRouter',
            'cerebras': 'Cerebras'
        };

        return displayNames[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
    }

    /**
     * Get icon for a provider
     */
    private getProviderIcon(provider: string): string {
        const icons: Record<string, string> = {
            'openai': '🤖',
            'anthropic': '🧠', 
            'google-ai-studio': '🔷',
            'openrouter': '🔀',
            'cerebras': '⚡'
        };

        return icons[provider] || '🔑';
    }

    /**
     * Get description for a provider
     */
    private getProviderDescription(provider: string): string {
        const descriptions: Record<string, string> = {
            'openai': 'GPT models, DALL-E, and other OpenAI services',
            'anthropic': 'Claude models for advanced reasoning and analysis',
            'google-ai-studio': 'Gemini models from Google for multimodal AI',
            'openrouter': 'Access to multiple AI providers through one API',
            'cerebras': 'High-speed inference for rapid AI processing'
        };

        return descriptions[provider] || `API key for ${provider} services`;
    }
}