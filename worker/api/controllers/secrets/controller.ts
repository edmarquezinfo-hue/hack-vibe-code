/**
 * Secrets Controller
 * Handles API endpoints for user secrets and API keys management
 * Refactored to use new database service structure and proper typing
 */

import { BaseController } from '../BaseController';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { RouteContext } from '../../types/route-context';
import { SecretsService } from '../../../database/services/SecretsService';
import {
    SecretsData,
    SecretStoreData,
    SecretDeleteData,
    SecretTemplatesData,
} from './types';
import { getTemplatesData, SecretTemplate } from '../../../types/secretsTemplates';

export class SecretsController extends BaseController {
    
    constructor() {
        super();
    }

    /**
     * Create service instance with proper database service integration
     */
    private createSecretsService(env: Env): SecretsService {
        const dbService = this.createDbService(env);
        return new SecretsService(dbService, env);
    }

    /**
     * Extract provider name from BYOK template
     * Example: "OPENAI_API_KEY_BYOK" -> "openai"
     */
    public extractProviderFromBYOKTemplate(template: SecretTemplate): string {
        return template.envVarName
            .replace('_API_KEY_BYOK', '')
            .toLowerCase()
            .replace(/_/g, '-');
    }

    /**
     * Get all user secrets (without decrypted values)
     * GET /api/secrets
     */
    async getSecrets(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretsData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<SecretsData>('Authentication required', 401);
            }

            const secretsService = this.createSecretsService(env);
            const secrets = await secretsService.getUserSecrets(user.id);

            const responseData: SecretsData = { secrets };
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting user secrets:', error);
            return this.createErrorResponse<SecretsData>('Failed to get user secrets', 500);
        }
    }

    /**
     * Get all user secrets including inactive ones (for management purposes)
     * GET /api/secrets/all
     */
    async getAllSecrets(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretsData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<SecretsData>('Authentication required', 401);
            }

            const secretsService = this.createSecretsService(env);
            const secrets = await secretsService.getAllUserSecrets(user.id);

            const responseData: SecretsData = { secrets };
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting all user secrets:', error);
            return this.createErrorResponse<SecretsData>('Failed to get all user secrets', 500);
        }
    }

    /**
     * Store a new secret
     * POST /api/secrets
     */
    async storeSecret(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretStoreData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<SecretStoreData>('Authentication required', 401);
            }

            const bodyResult = await this.parseJsonBody<{
                templateId?: string;  // For predefined templates
                name?: string;        // For custom secrets
                envVarName?: string;  // For custom secrets
                value: string;
                environment?: string;
                description?: string;
            }>(request);

            if (!bodyResult.success) {
                return bodyResult.response! as ControllerResponse<ApiResponse<SecretStoreData>>;
            }

            const { templateId, name, envVarName, value, environment, description } = bodyResult.data!;

            // Validate required fields
            if (!value) {
                return this.createErrorResponse<SecretStoreData>('Missing required field: value', 400);
            }

            let secretData;

            if (templateId) {
                // Using predefined template
                const templates = getTemplatesData();
                const template = templates.find(t => t.id === templateId);
                
                if (!template) {
                    return this.createErrorResponse<SecretStoreData>('Invalid template ID', 400);
                }

                // Validate against template validation if provided
                if (template.validation && !new RegExp(template.validation).test(value)) {
                    return this.createErrorResponse<SecretStoreData>(`Invalid format for ${template.displayName}. Expected format: ${template.placeholder}`, 400);
                }

                secretData = {
                    name: template.displayName,
                    provider: template.provider,
                    secretType: template.envVarName,
                    value: value.trim(),
                    environment: environment || 'production',
                    description: template.description
                };
            } else {
                // Custom secret
                if (!name || !envVarName) {
                    return this.createErrorResponse<SecretStoreData>('Missing required fields for custom secret: name, envVarName', 400);
                }

                // Validate environment variable name format
                if (!/^[A-Z][A-Z0-9_]*$/.test(envVarName)) {
                    return this.createErrorResponse<SecretStoreData>('Environment variable name must be uppercase and contain only letters, numbers, and underscores', 400);
                }

                secretData = {
                    name: name.trim(),
                    provider: 'custom',
                    secretType: envVarName.trim().toUpperCase(),
                    value: value.trim(),
                    environment: environment || 'production',
                    description: description?.trim()
                };
            }

            const secretsService = this.createSecretsService(env);
            const storedSecret = await secretsService.storeSecret(user.id, secretData);

            const responseData: SecretStoreData = {
                secret: storedSecret,
                message: 'Secret stored successfully'
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error storing secret:', error);
            return this.createErrorResponse<SecretStoreData>('Failed to store secret', 500);
        }
    }

    /**
     * Delete a secret
     * DELETE /api/secrets/:secretId
     */
    async deleteSecret(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretDeleteData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<SecretDeleteData>('Authentication required', 401);
            }

            const secretId = context.pathParams.secretId;

            if (!secretId) {
                return this.createErrorResponse<SecretDeleteData>('Secret ID is required', 400);
            }

            const secretsService = this.createSecretsService(env);
            await secretsService.deleteSecret(user.id, secretId);

            const responseData: SecretDeleteData = {
                message: 'Secret deleted successfully'
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error deleting secret:', error);
            return this.createErrorResponse<SecretDeleteData>('Failed to delete secret', 500);
        }
    }

    /**
     * Toggle secret active status
     * PATCH /api/secrets/:secretId/toggle
     */
    async toggleSecret(_request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<ControllerResponse<ApiResponse<SecretStoreData>>> {
        try {
            const user = this.extractAuthUser(context);
            if (!user) {
                return this.createErrorResponse<SecretStoreData>('Authentication required', 401);
            }

            const secretId = context.pathParams.secretId;

            if (!secretId) {
                return this.createErrorResponse<SecretStoreData>('Secret ID is required', 400);
            }

            const secretsService = this.createSecretsService(env);
            const toggledSecret = await secretsService.toggleSecretActiveStatus(user.id, secretId);

            const responseData: SecretStoreData = {
                secret: toggledSecret,
                message: `Secret ${toggledSecret.isActive ? 'activated' : 'deactivated'} successfully`
            };

            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error toggling secret status:', error);
            return this.createErrorResponse<SecretStoreData>('Failed to toggle secret status', 500);
        }
    }

    /**
     * Get predefined secret templates for common providers
     * GET /api/secrets/templates
     */
    async getTemplates(request: Request, _env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<SecretTemplatesData>>> {
        try {
            const url = new URL(request.url);
            const category = url.searchParams.get('category');
            
            let templates = getTemplatesData();
            
            if (category) {
                templates = templates.filter(template => template.category === category);
            }
            
            const responseData: SecretTemplatesData = { templates };
            return this.createSuccessResponse(responseData);
        } catch (error) {
            this.logger.error('Error getting secret templates:', error);
            return this.createErrorResponse<SecretTemplatesData>('Failed to get secret templates', 500);
        }
    }
}