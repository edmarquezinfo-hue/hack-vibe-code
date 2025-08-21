/**
 * Secrets Controller
 * Handles API endpoints for user secrets and API keys management
 * Refactored to use new database service structure and proper typing
 */

import { BaseController } from '../BaseController';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { SecretsService } from '../../../database/services/SecretsService';
import {
    SecretsData,
    SecretStoreData,
    SecretDeleteData,
    SecretTemplatesData,
    SecretTemplate
} from './types';

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
     * Get BYOK templates dynamically
     */
    public getBYOKTemplates(): SecretTemplate[] {
        return this.getTemplatesData().filter(template => template.category === 'byok');
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
     * Get templates data (helper method)
     */
    private getTemplatesData(): SecretTemplate[] {
        const templates = [
            // Cloudflare (Priority - Required for deployments)
            {
                id: 'CLOUDFLARE_API_KEY',
                displayName: 'Cloudflare API Key',
                envVarName: 'CLOUDFLARE_API_KEY',
                provider: 'cloudflare',
                icon: '☁️',
                description: 'Global API Key with Worker and AI Gateway permissions',
                instructions: 'Go to Cloudflare Dashboard → My Profile → API Tokens → Global API Key',
                placeholder: 'Your 40-character hex API key',
                validation: '^[a-f0-9]{40}$',
                required: true,
                category: 'deployment'
            },
            {
                id: 'CLOUDFLARE_ACCOUNT_ID',
                displayName: 'Cloudflare Account ID',
                envVarName: 'CLOUDFLARE_ACCOUNT_ID',
                provider: 'cloudflare',
                icon: '☁️',
                description: 'Your Cloudflare Account ID for resource management',
                instructions: 'Go to Cloudflare Dashboard → Right sidebar → Account ID (copy the ID)',
                placeholder: 'Your 32-character hex account ID',
                validation: '^[a-f0-9]{32}$',
                required: true,
                category: 'deployment'
            },
            
            // Payment Processing
            {
                id: 'STRIPE_SECRET_KEY',
                displayName: 'Stripe Secret Key',
                envVarName: 'STRIPE_SECRET_KEY',
                provider: 'stripe',
                icon: '💳',
                description: 'Stripe secret key for payment processing',
                instructions: 'Go to Stripe Dashboard → Developers → API keys → Secret key',
                placeholder: 'sk_test_... or sk_live_...',
                validation: '^sk_(test_|live_)[a-zA-Z0-9]{48,}$',
                required: false,
                category: 'payments'
            },
            {
                id: 'STRIPE_PUBLISHABLE_KEY',
                displayName: 'Stripe Publishable Key',
                envVarName: 'STRIPE_PUBLISHABLE_KEY',
                provider: 'stripe',
                icon: '💳',
                description: 'Stripe publishable key for frontend integration',
                instructions: 'Go to Stripe Dashboard → Developers → API keys → Publishable key',
                placeholder: 'pk_test_... or pk_live_...',
                validation: '^pk_(test_|live_)[a-zA-Z0-9]{48,}$',
                required: false,
                category: 'payments'
            },
            
            // AI Services
            {
                id: 'OPENAI_API_KEY',
                displayName: 'OpenAI API Key',
                envVarName: 'OPENAI_API_KEY',
                provider: 'openai',
                icon: '🤖',
                description: 'OpenAI API key for GPT and other AI models',
                instructions: 'Go to OpenAI Platform → API keys → Create new secret key',
                placeholder: 'sk-...',
                validation: '^sk-[a-zA-Z0-9]{48,}$',
                required: false,
                category: 'ai'
            },
            {
                id: 'ANTHROPIC_API_KEY',
                displayName: 'Anthropic API Key',
                envVarName: 'ANTHROPIC_API_KEY',
                provider: 'anthropic',
                icon: '🧠',
                description: 'Anthropic Claude API key',
                instructions: 'Go to Anthropic Console → API Keys → Create Key',
                placeholder: 'sk-ant-...',
                validation: '^sk-ant-[a-zA-Z0-9_-]{48,}$',
                required: false,
                category: 'ai'
            },
            {
                id: 'GEMINI_API_KEY',
                displayName: 'Google Gemini API Key',
                envVarName: 'GEMINI_API_KEY',
                provider: 'google-ai-studio',
                icon: '🔷',
                description: 'Google Gemini AI API key',
                instructions: 'Go to Google AI Studio → Get API key',
                placeholder: 'AI...',
                validation: '^AI[a-zA-Z0-9_-]{35,}$',
                required: false,
                category: 'ai'
            },
            {
                id: 'OPENROUTER_API_KEY',
                displayName: 'OpenRouter API Key',
                envVarName: 'OPENROUTER_API_KEY',
                provider: 'openrouter',
                icon: '🔀',
                description: 'OpenRouter API key for multiple AI providers',
                instructions: 'Go to OpenRouter → Account → Keys → Create new key',
                placeholder: 'sk-or-...',
                validation: '^sk-or-[a-zA-Z0-9_-]{48,}$',
                required: false,
                category: 'ai'
            },
            
            // BYOK (Bring Your Own Key) AI Providers - Lenient validation for compatibility
            {
                id: 'OPENAI_API_KEY_BYOK',
                displayName: 'OpenAI (BYOK)',
                envVarName: 'OPENAI_API_KEY_BYOK',
                provider: 'openai',
                icon: '🤖',
                description: 'Use your OpenAI API key for GPT models via Cloudflare AI Gateway',
                instructions: 'Go to OpenAI Platform → API Keys → Create new secret key',
                placeholder: 'sk-proj-... or sk-...',
                validation: '^sk-.{10,}$',
                required: false,
                category: 'byok'
            },
            {
                id: 'ANTHROPIC_API_KEY_BYOK',
                displayName: 'Anthropic (BYOK)',
                envVarName: 'ANTHROPIC_API_KEY_BYOK',
                provider: 'anthropic',
                icon: '🧠',
                description: 'Use your Anthropic API key for Claude models via Cloudflare AI Gateway',
                instructions: 'Go to Anthropic Console → API Keys → Create Key',
                placeholder: 'sk-ant-api03-...',
                validation: '^sk-ant-.{10,}$',
                required: false,
                category: 'byok'
            },
            {
                id: 'GOOGLE_AI_STUDIO_API_KEY_BYOK',
                displayName: 'Google AI Studio (BYOK)',
                envVarName: 'GOOGLE_AI_STUDIO_API_KEY_BYOK',
                provider: 'google-ai-studio',
                icon: '🔷',
                description: 'Use your Google AI API key for Gemini models via Cloudflare AI Gateway',
                instructions: 'Go to Google AI Studio → Get API Key',
                placeholder: 'AIzaSy...',
                validation: '^AIza.{20,}$',
                required: false,
                category: 'byok'
            },
            {
                id: 'CEREBRAS_API_KEY_BYOK',
                displayName: 'Cerebras (BYOK)',
                envVarName: 'CEREBRAS_API_KEY_BYOK',
                provider: 'cerebras',
                icon: '🧮',
                description: 'Use your Cerebras API key for high-performance inference via Cloudflare AI Gateway',
                instructions: 'Go to Cerebras Platform → API Keys → Create new key',
                placeholder: 'csk-... or any format',
                validation: '^.{10,}$',
                required: false,
                category: 'byok'
            },
            
            // Development Tools
            {
                id: 'GITHUB_TOKEN',
                displayName: 'GitHub Personal Access Token',
                envVarName: 'GITHUB_TOKEN',
                provider: 'github',
                icon: '🐙',
                description: 'GitHub token for repository operations',
                instructions: 'Go to GitHub → Settings → Developer settings → Personal access tokens → Generate new token',
                placeholder: 'ghp_... or github_pat_...',
                validation: '^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{80,})$',
                required: false,
                category: 'development'
            },
            {
                id: 'VERCEL_TOKEN',
                displayName: 'Vercel Access Token',
                envVarName: 'VERCEL_TOKEN',
                provider: 'vercel',
                icon: '▲',
                description: 'Vercel token for deployments',
                instructions: 'Go to Vercel Dashboard → Settings → Tokens → Create',
                placeholder: 'Your Vercel access token',
                validation: '^[a-zA-Z0-9]{24}$',
                required: false,
                category: 'deployment'
            },
            
            // Database & Storage
            {
                id: 'SUPABASE_URL',
                displayName: 'Supabase Project URL',
                envVarName: 'SUPABASE_URL',
                provider: 'supabase',
                icon: '🗄️',
                description: 'Supabase project URL',
                instructions: 'Go to Supabase Dashboard → Settings → API → Project URL',
                placeholder: 'https://xxx.supabase.co',
                validation: '^https://[a-z0-9]+\\.supabase\\.co$',
                required: false,
                category: 'database'
            },
            {
                id: 'SUPABASE_ANON_KEY',
                displayName: 'Supabase Anonymous Key',
                envVarName: 'SUPABASE_ANON_KEY',
                provider: 'supabase',
                icon: '🗄️',
                description: 'Supabase anonymous/public key',
                instructions: 'Go to Supabase Dashboard → Settings → API → anon public key',
                placeholder: 'eyJ...',
                validation: '^eyJ[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+$',
                required: false,
                category: 'database'
            }
        ];
        
        return templates;
    }

    /**
     * Get all user secrets (without decrypted values)
     * GET /api/secrets
     */
    async getSecrets(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<SecretsData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<SecretsData>>;
            }

            const secretsService = this.createSecretsService(env);
            const secrets = await secretsService.getUserSecrets(authResult.user!.id);

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
    async getAllSecrets(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<SecretsData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<SecretsData>>;
            }

            const secretsService = this.createSecretsService(env);
            const secrets = await secretsService.getAllUserSecrets(authResult.user!.id);

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
    async storeSecret(request: Request, env: Env, _ctx: ExecutionContext): Promise<ControllerResponse<ApiResponse<SecretStoreData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<SecretStoreData>>;
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
                const templates = this.getTemplatesData();
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
            const storedSecret = await secretsService.storeSecret(authResult.user!.id, secretData);

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
    async deleteSecret(request: Request, env: Env, _ctx: ExecutionContext, params: Record<string, string> = {}): Promise<ControllerResponse<ApiResponse<SecretDeleteData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<SecretDeleteData>>;
            }

            const secretId = params.secretId;

            if (!secretId) {
                return this.createErrorResponse<SecretDeleteData>('Secret ID is required', 400);
            }

            const secretsService = this.createSecretsService(env);
            await secretsService.deleteSecret(authResult.user!.id, secretId);

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
    async toggleSecret(request: Request, env: Env, _ctx: ExecutionContext, params: Record<string, string> = {}): Promise<ControllerResponse<ApiResponse<SecretStoreData>>> {
        try {
            const authResult = await this.requireAuth(request, env);
            if (!authResult.success) {
                return authResult.response! as ControllerResponse<ApiResponse<SecretStoreData>>;
            }

            const secretId = params.secretId;

            if (!secretId) {
                return this.createErrorResponse<SecretStoreData>('Secret ID is required', 400);
            }

            const secretsService = this.createSecretsService(env);
            const toggledSecret = await secretsService.toggleSecretActiveStatus(authResult.user!.id, secretId);

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
            
            let templates = this.getTemplatesData();
            
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