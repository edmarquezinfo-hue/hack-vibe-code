/**
 * Secrets Controller
 * Handles API endpoints for user secrets and API keys management
 */

import { BaseController } from './BaseController';
import { SecretsService } from '../../services/secrets/secretsService';

export class SecretsController extends BaseController {
    
    constructor(private env: Env) {
        super();
    }

    /**
     * Get templates data (helper method)
     */
    private async getTemplatesData() {
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
                provider: 'google',
                icon: '🔷',
                description: 'Google Gemini AI API key',
                instructions: 'Go to Google AI Studio → Get API key',
                placeholder: 'AI...',
                validation: '^AI[a-zA-Z0-9_-]{35,}$',
                required: false,
                category: 'ai'
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
    async getSecrets(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const db = this.createDbService(this.env);
            const secretsService = new SecretsService(db, this.env);
            
            const secrets = await secretsService.getUserSecrets(session.userId);

            return this.createSuccessResponse({
                secrets
            });
        } catch (error) {
            return this.handleError(error, 'get user secrets');
        }
    }

    /**
     * Store a new secret
     * POST /api/secrets
     */
    async storeSecret(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
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
                return bodyResult.response!;
            }

            const { templateId, name, envVarName, value, environment, description } = bodyResult.data!;

            // Validate required fields
            if (!value) {
                return this.createErrorResponse('Missing required field: value', 400);
            }

            let secretData;

            if (templateId) {
                // Using predefined template
                const templates = await this.getTemplatesData();
                const template = templates.find(t => t.id === templateId);
                
                if (!template) {
                    return this.createErrorResponse('Invalid template ID', 400);
                }

                // Validate against template validation if provided
                if (template.validation && !new RegExp(template.validation).test(value)) {
                    return this.createErrorResponse(`Invalid format for ${template.displayName}. Expected format: ${template.placeholder}`, 400);
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
                    return this.createErrorResponse('Missing required fields for custom secret: name, envVarName', 400);
                }

                // Validate environment variable name format
                if (!/^[A-Z][A-Z0-9_]*$/.test(envVarName)) {
                    return this.createErrorResponse('Environment variable name must be uppercase and contain only letters, numbers, and underscores', 400);
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

            const db = this.createDbService(this.env);
            const secretsService = new SecretsService(db, this.env);

            const storedSecret = await secretsService.storeSecret(session.userId, secretData);

            return this.createSuccessResponse({
                secret: storedSecret,
                message: 'Secret stored successfully'
            });
        } catch (error) {
            return this.handleError(error, 'store secret');
        }
    }

    /**
     * Delete a secret
     * DELETE /api/secrets/:secretId
     */
    async deleteSecret(request: Request): Promise<Response> {
        try {
            const session = await this.getSessionFromRequest(request, this.env);
            
            if (!session) {
                return this.createErrorResponse('Unauthorized', 401);
            }

            const pathParams = this.extractPathParams(request, ['secretId']);
            const secretId = pathParams.secretId;

            if (!secretId) {
                return this.createErrorResponse('Secret ID is required', 400);
            }

            const db = this.createDbService(this.env);
            const secretsService = new SecretsService(db, this.env);

            await secretsService.deleteSecret(session.userId, secretId);

            return this.createSuccessResponse({
                message: 'Secret deleted successfully'
            });
        } catch (error) {
            return this.handleError(error, 'delete secret');
        }
    }

    /**
     * Get predefined secret templates for common providers
     * GET /api/secrets/templates
     */
    async getTemplates(_request: Request): Promise<Response> {
        try {
            const templates = await this.getTemplatesData();
            return this.createSuccessResponse({ templates });
        } catch (error) {
            return this.handleError(error, 'get secret templates');
        }
    }
}