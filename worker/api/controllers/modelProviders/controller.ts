/**
 * Model Providers Controller
 * Handles CRUD operations for user custom model providers
 */

import { BaseController } from '../BaseController';
import { RouteContext } from '../../types/route-context';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { SecretsService } from '../../../database/services/SecretsService';
import { DatabaseService } from '../../../database/database';
import { userModelProviders } from '../../../database/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '../../../utils/idGenerator';
import { z } from 'zod';
import {
    ModelProvidersListData,
    ModelProviderData,
    ModelProviderCreateData,
    ModelProviderUpdateData,
    ModelProviderDeleteData,
    ModelProviderTestData,
    CreateProviderRequest,
    UpdateProviderRequest,
    TestProviderRequest
} from './types';

// Validation schemas
const createProviderSchema = z.object({
    name: z.string().min(1).max(100),
    baseUrl: z.string().url(),
    apiKey: z.string().min(1)
});

const updateProviderSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    isActive: z.boolean().optional()
});

const testProviderSchema = z.object({
    providerId: z.string().optional(),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().min(1).optional()
}).refine(
    (data) => data.providerId || (data.baseUrl && data.apiKey),
    "Either providerId or both baseUrl and apiKey must be provided"
);

export class ModelProvidersController extends BaseController {
    constructor() {
        super();
    }

    /**
     * Get all custom providers for the authenticated user
     */
    async getProviders(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProvidersListData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<ModelProvidersListData>('Authentication required', 401);
            }

            const dbService = new DatabaseService({ DB: env.DB });
            
            const providers = await dbService.db
                .select()
                .from(userModelProviders)
                .where(
                    and(
                        eq(userModelProviders.userId, user.id),
                        eq(userModelProviders.isActive, true)
                    )
                )
                .orderBy(userModelProviders.createdAt);

            const responseData: ModelProvidersListData = {
                providers
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching model providers:', error);
            return this.createErrorResponse<ModelProvidersListData>('Failed to fetch providers', 500);
        }
    }

    /**
     * Get a specific provider by ID
     */
    async getProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<ModelProviderData>('Authentication required', 401);
            }

            const url = new URL(request.url);
            const providerId = url.pathname.split('/').pop();

            if (!providerId) {
                return this.createErrorResponse<ModelProviderData>('Provider ID is required', 400);
            }

            const dbService = new DatabaseService({ DB: env.DB });
            
            const provider = await dbService.db
                .select()
                .from(userModelProviders)
                .where(
                    and(
                        eq(userModelProviders.id, providerId),
                        eq(userModelProviders.userId, user.id)
                    )
                )
                .get();

            if (!provider) {
                return this.createErrorResponse<ModelProviderData>('Provider not found', 404);
            }

            const responseData: ModelProviderData = {
                provider
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error fetching model provider:', error);
            return this.createErrorResponse<ModelProviderData>('Failed to fetch provider', 500);
        }
    }

    /**
     * Create a new custom provider
     */
    async createProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderCreateData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<ModelProviderCreateData>('Authentication required', 401);
            }

            const body = await this.parseJsonBody<CreateProviderRequest>(request);
            if (!body) {
                return this.createErrorResponse<ModelProviderCreateData>('Invalid request body', 400);
            }

            const validation = createProviderSchema.safeParse(body);
            if (!validation.success) {
                return this.createErrorResponse<ModelProviderCreateData>(
                    `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const { name, baseUrl, apiKey } = validation.data;
            const dbService = new DatabaseService({ DB: env.DB });
            const secretsService = new SecretsService(dbService, env);

            // Check if provider name already exists for user
            const existingProvider = await dbService.db
                .select()
                .from(userModelProviders)
                .where(
                    and(
                        eq(userModelProviders.userId, user.id),
                        eq(userModelProviders.name, name)
                    )
                )
                .get();

            if (existingProvider) {
                return this.createErrorResponse<ModelProviderCreateData>('Provider name already exists', 409);
            }

            // Store API key in userSecrets
            const secretResult = await secretsService.storeSecret(user.id, {
                name: `${name} API Key`,
                provider: 'custom',
                secretType: 'api_key',
                value: apiKey,
                description: `API key for custom provider: ${name}`
            });
            const secretId = secretResult.id;

            // Create provider record
            const providerId = generateId();
            const provider = {
                id: providerId,
                userId: user.id,
                name,
                baseUrl,
                secretId,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await dbService.db
                .insert(userModelProviders)
                .values(provider);

            const responseData: ModelProviderCreateData = {
                provider
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error creating model provider:', error);
            return this.createErrorResponse<ModelProviderCreateData>('Failed to create provider', 500);
        }
    }

    /**
     * Update an existing provider
     */
    async updateProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderUpdateData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<ModelProviderUpdateData>('Authentication required', 401);
            }

            const url = new URL(request.url);
            const providerId = url.pathname.split('/').pop();

            if (!providerId) {
                return this.createErrorResponse<ModelProviderUpdateData>('Provider ID is required', 400);
            }

            const body = await this.parseJsonBody<UpdateProviderRequest>(request);
            if (!body) {
                return this.createErrorResponse<ModelProviderUpdateData>('Invalid request body', 400);
            }

            const validation = updateProviderSchema.safeParse(body);
            if (!validation.success) {
                return this.createErrorResponse<ModelProviderUpdateData>(
                    `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            const dbService = new DatabaseService({ DB: env.DB });
            const secretsService = new SecretsService(dbService, env);

            // Check if provider exists and belongs to user
            const existingProvider = await dbService.db
                .select()
                .from(userModelProviders)
                .where(
                    and(
                        eq(userModelProviders.id, providerId),
                        eq(userModelProviders.userId, user.id)
                    )
                )
                .get();

            if (!existingProvider) {
                return this.createErrorResponse<ModelProviderUpdateData>('Provider not found', 404);
            }

            const updates = validation.data;
            const updateData: Partial<typeof userModelProviders.$inferInsert> = {
                updatedAt: new Date()
            };

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.baseUrl !== undefined) updateData.baseUrl = updates.baseUrl;
            if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

            // Update API key if provided
            if (updates.apiKey) {
                if (existingProvider.secretId) {
                    // For now, we'll create a new secret since updateSecret doesn't exist
                    // In production, you'd want to implement updateSecret in SecretsService
                    const secretResult = await secretsService.storeSecret(user.id, {
                        name: `${updates.name || existingProvider.name} API Key`,
                        provider: 'custom',
                        secretType: 'api_key',
                        value: updates.apiKey,
                        description: `API key for custom provider: ${updates.name || existingProvider.name}`
                    });
                    updateData.secretId = secretResult.id;
                } else {
                    // Create new secret
                    const secretResult = await secretsService.storeSecret(user.id, {
                        name: `${updates.name || existingProvider.name} API Key`,
                        provider: 'custom',
                        secretType: 'api_key',
                        value: updates.apiKey,
                        description: `API key for custom provider: ${updates.name || existingProvider.name}`
                    });
                    updateData.secretId = secretResult.id;
                }
            }

            // Update provider
            await dbService.db
                .update(userModelProviders)
                .set(updateData)
                .where(eq(userModelProviders.id, providerId));

            // Get updated provider
            const updatedProvider = await dbService.db
                .select()
                .from(userModelProviders)
                .where(eq(userModelProviders.id, providerId))
                .get();

            const responseData: ModelProviderUpdateData = {
                provider: updatedProvider!
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error updating model provider:', error);
            return this.createErrorResponse<ModelProviderUpdateData>('Failed to update provider', 500);
        }
    }

    /**
     * Delete a provider
     */
    async deleteProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderDeleteData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<ModelProviderDeleteData>('Authentication required', 401);
            }

            const url = new URL(request.url);
            const providerId = url.pathname.split('/').pop();

            if (!providerId) {
                return this.createErrorResponse<ModelProviderDeleteData>('Provider ID is required', 400);
            }

            const dbService = new DatabaseService({ DB: env.DB });

            // Check if provider exists and belongs to user
            const existingProvider = await dbService.db
                .select()
                .from(userModelProviders)
                .where(
                    and(
                        eq(userModelProviders.id, providerId),
                        eq(userModelProviders.userId, user.id)
                    )
                )
                .get();

            if (!existingProvider) {
                return this.createErrorResponse<ModelProviderDeleteData>('Provider not found', 404);
            }

            // Delete provider (soft delete by setting isActive = false)
            await dbService.db
                .update(userModelProviders)
                .set({ 
                    isActive: false,
                    updatedAt: new Date()
                })
                .where(eq(userModelProviders.id, providerId));

            // Note: We'll keep the secret for now as deleteSecret method needs to be implemented
            // In production, you'd want to implement deleteSecret in SecretsService

            const responseData: ModelProviderDeleteData = {
                success: true,
                providerId
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error deleting model provider:', error);
            return this.createErrorResponse<ModelProviderDeleteData>('Failed to delete provider', 500);
        }
    }

    /**
     * Test provider connection
     */
    async testProvider(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<ModelProviderTestData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<ModelProviderTestData>('Authentication required', 401);
            }

            const body = await this.parseJsonBody<TestProviderRequest>(request);
            if (!body) {
                return this.createErrorResponse<ModelProviderTestData>('Invalid request body', 400);
            }

            const validation = testProviderSchema.safeParse(body);
            if (!validation.success) {
                return this.createErrorResponse<ModelProviderTestData>(
                    `Validation error: ${validation.error.errors.map(e => e.message).join(', ')}`, 
                    400
                );
            }

            let baseUrl: string;
            let apiKey: string;

            if (validation.data.providerId) {
                // Test existing provider
                const dbService = new DatabaseService({ DB: env.DB });
                const provider = await dbService.db
                    .select()
                    .from(userModelProviders)
                    .where(
                        and(
                            eq(userModelProviders.id, validation.data.providerId),
                            eq(userModelProviders.userId, user.id)
                        )
                    )
                    .get();

                if (!provider) {
                    return this.createErrorResponse<ModelProviderTestData>('Provider not found', 404);
                }

                if (!provider.secretId) {
                    return this.createErrorResponse<ModelProviderTestData>('Provider has no API key', 400);
                }

                const secretsService = new SecretsService(dbService, env);
                const secretValue = await secretsService.getSecretValue(user.id, provider.secretId);
                
                if (!secretValue) {
                    return this.createErrorResponse<ModelProviderTestData>('API key not found', 404);
                }

                baseUrl = provider.baseUrl;
                apiKey = secretValue;
            } else {
                // Test new provider configuration
                baseUrl = validation.data.baseUrl!;
                apiKey = validation.data.apiKey!;
            }

            // Test the API by making a simple request
            const startTime = Date.now();
            try {
                const testUrl = `${baseUrl.replace(/\/$/, '')}/models`;
                const response = await fetch(testUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                const responseTime = Date.now() - startTime;

                if (response.ok) {
                    const responseData: ModelProviderTestData = {
                        success: true,
                        responseTime
                    };
                    return this.createSuccessResponse(responseData);
                } else {
                    const errorText = await response.text();
                    const responseData: ModelProviderTestData = {
                        success: false,
                        error: `API request failed: ${response.status} ${errorText}`,
                        responseTime
                    };
                    return this.createSuccessResponse(responseData);
                }
            } catch (error) {
                const responseTime = Date.now() - startTime;
                const responseData: ModelProviderTestData = {
                    success: false,
                    error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    responseTime
                };
                return this.createSuccessResponse(responseData);
            }
        } catch (error) {
            this.logger.error('Error testing model provider:', error);
            return this.createErrorResponse<ModelProviderTestData>('Failed to test provider', 500);
        }
    }
}