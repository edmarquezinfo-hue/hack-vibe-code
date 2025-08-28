/**
 * BYOK (Bring Your Own Key) Helper Functions
 * Handles provider discovery and model filtering for users with custom API keys
 * Completely dynamic - no hardcoded provider lists
 */

import { AIModels } from '../../../agents/inferutils/config.types';
import type { UserProviderStatus, ModelsByProvider } from './types';
import { SecretsService } from '../../../database/services/SecretsService';
import { DatabaseService } from '../../../database/database';


/**
 * Get BYOK templates dynamically from secrets controller
 */
async function getBYOKTemplates(): Promise<Array<{ envVarName: string; provider: string }>> {
    const { SecretsController } = await import('../secrets/controller');
    const controller = new SecretsController();
    
    const templates = controller.getBYOKTemplates();
    
    return templates.map(template => ({
        envVarName: template.envVarName,
        provider: template.provider
    }));
}

/**
 * Get user's provider status for BYOK functionality
 */
export async function getUserProviderStatus(userId: string, env: Env): Promise<UserProviderStatus[]> {
  try {
    const dbService = new DatabaseService({ DB: env.DB });
    const secretsService = new SecretsService(dbService, env);
    
    // Get BYOK templates dynamically
    const byokTemplates = await getBYOKTemplates();
    
    // Get all user secrets
    const userSecrets = await secretsService.getUserSecrets(userId);
    
    const providerStatuses: UserProviderStatus[] = [];
    
    for (const template of byokTemplates) {
      // Find secret for this BYOK template
      const providerSecret = userSecrets.find(secret => 
        secret.secretType === template.envVarName && 
        secret.isActive
      );
      
      providerStatuses.push({
        provider: template.provider,
        hasValidKey: !!providerSecret,
        keyPreview: providerSecret?.keyPreview
      });
    }
    
    return providerStatuses;
  } catch (error) {
    console.error('Error getting user provider status:', error);
    
    // Fallback - try to get templates again for error recovery
    try {
      const byokTemplates = await getBYOKTemplates();
      return byokTemplates.map(template => ({
        provider: template.provider,
        hasValidKey: false
      }));
    } catch {
      return []; // Complete fallback
    }
  }
}

/**
 * Get models available for BYOK providers that user has keys for
 */
export function getByokModels(providerStatuses: UserProviderStatus[]): ModelsByProvider {
  const modelsByProvider: ModelsByProvider = {};
  
  providerStatuses
    .filter(status => status.hasValidKey)
    .forEach(status => {
      // Get models for this provider dynamically from AIModels enum
      const providerModels = Object.values(AIModels).filter(model => 
        model.startsWith(`${status.provider}/`)
      );
      
      if (providerModels.length > 0) {
        modelsByProvider[status.provider] = providerModels;
      }
    });
  
  return modelsByProvider;
}

/**
 * Get all platform models (served via AI Gateway with Cloudflare keys)
 */
export function getPlatformModels(): AIModels[] {
  return Object.values(AIModels);
}

/**
 * Get provider name from model string
 */
export function getProviderFromModel(model: AIModels | string): string {
  if (typeof model === 'string' && model.includes('/')) {
    return model.split('/')[0];
  }
  return 'cloudflare';
}