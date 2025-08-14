/**
 * Model Configuration Service
 * Handles CRUD operations for user model configurations
 */

import { DatabaseService } from '../../database/database';
import { UserModelConfig, NewUserModelConfig, userModelConfigs } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { AgentActionKey, AGENT_CONFIG, ModelConfig } from '../../agents/inferutils/config';
import { generateId } from '../../utils/idGenerator';

export interface MergedModelConfig extends ModelConfig {
    isUserOverride: boolean;
    userConfigId?: string;
}

export class ModelConfigService {
    constructor(private db: DatabaseService) {}

    /**
     * Get all model configurations for a user (merged with defaults)
     */
    async getUserModelConfigs(userId: string): Promise<Record<AgentActionKey, MergedModelConfig>> {
        const userConfigs = await this.db.db
            .select()
            .from(userModelConfigs)
            .where(and(
                eq(userModelConfigs.userId, userId),
                eq(userModelConfigs.isActive, true)
            ));

        const result: Record<string, MergedModelConfig> = {};

        // Start with all default configurations
        for (const [actionKey, defaultConfig] of Object.entries(AGENT_CONFIG)) {
            const userConfig = userConfigs.find((uc: UserModelConfig) => uc.agentActionName === actionKey);
            
            if (userConfig) {
                // Merge user config with defaults (user config takes precedence, null values use defaults)
                result[actionKey] = {
                    name: userConfig.modelName as any || defaultConfig.name,
                    max_tokens: userConfig.maxTokens || defaultConfig.max_tokens,
                    temperature: userConfig.temperature !== null ? userConfig.temperature : defaultConfig.temperature,
                    reasoning_effort: userConfig.reasoningEffort as any || defaultConfig.reasoning_effort,
                    providerOverride: userConfig.providerOverride as any || defaultConfig.providerOverride,
                    fallbackModel: userConfig.fallbackModel as any || defaultConfig.fallbackModel,
                    isUserOverride: true,
                    userConfigId: userConfig.id
                };
            } else {
                // Use default config
                result[actionKey] = {
                    ...defaultConfig,
                    isUserOverride: false
                };
            }
        }

        return result as Record<AgentActionKey, MergedModelConfig>;
    }

    /**
     * Get a specific model configuration for a user (merged with defaults for UI display)
     */
    async getUserModelConfig(userId: string, agentActionName: AgentActionKey): Promise<MergedModelConfig> {
        const userConfig = await this.db.db
            .select()
            .from(userModelConfigs)
            .where(and(
                eq(userModelConfigs.userId, userId),
                eq(userModelConfigs.agentActionName, agentActionName),
                eq(userModelConfigs.isActive, true)
            ))
            .limit(1);

        const defaultConfig = AGENT_CONFIG[agentActionName];
        
        if (userConfig.length > 0) {
            const config = userConfig[0];
            return {
                name: config.modelName as any || defaultConfig.name,
                max_tokens: config.maxTokens || defaultConfig.max_tokens,
                temperature: config.temperature !== null ? config.temperature : defaultConfig.temperature,
                reasoning_effort: config.reasoningEffort as any || defaultConfig.reasoning_effort,
                providerOverride: config.providerOverride as any || defaultConfig.providerOverride,
                fallbackModel: config.fallbackModel as any || defaultConfig.fallbackModel,
                isUserOverride: true,
                userConfigId: config.id
            };
        }

        return {
            ...defaultConfig,
            isUserOverride: false
        };
    }

    /**
     * Get raw user model configuration without merging with defaults
     * Returns null if user has no custom config (for executeInference usage)
     */
    async getRawUserModelConfig(userId: string, agentActionName: AgentActionKey): Promise<ModelConfig | null> {
        const userConfig = await this.db.db
            .select()
            .from(userModelConfigs)
            .where(and(
                eq(userModelConfigs.userId, userId),
                eq(userModelConfigs.agentActionName, agentActionName),
                eq(userModelConfigs.isActive, true)
            ))
            .limit(1);

        if (userConfig.length > 0) {
            const config = userConfig[0];
            
            // Only create ModelConfig if user has actual overrides
            const hasOverrides = config.modelName || config.maxTokens || 
                                config.temperature !== null || config.reasoningEffort || 
                                config.providerOverride || config.fallbackModel;
            
            if (hasOverrides) {
                const defaultConfig = AGENT_CONFIG[agentActionName];
                return {
                    name: config.modelName as any || defaultConfig.name,
                    max_tokens: config.maxTokens || defaultConfig.max_tokens,
                    temperature: config.temperature !== null ? config.temperature : defaultConfig.temperature,
                    reasoning_effort: config.reasoningEffort as any || defaultConfig.reasoning_effort,
                    providerOverride: config.providerOverride as any || defaultConfig.providerOverride,
                    fallbackModel: config.fallbackModel as any || defaultConfig.fallbackModel,
                };
            }
        }

        // Return null if user has no custom config - let AGENT_CONFIG defaults rule
        return null;
    }

    /**
     * Update or create a user model configuration
     */
    async upsertUserModelConfig(
        userId: string,
        agentActionName: AgentActionKey,
        config: Partial<ModelConfig>
    ): Promise<UserModelConfig> {
        const existingConfig = await this.db.db
            .select()
            .from(userModelConfigs)
            .where(and(
                eq(userModelConfigs.userId, userId),
                eq(userModelConfigs.agentActionName, agentActionName)
            ))
            .limit(1);

        const configData: Partial<NewUserModelConfig> = {
            userId,
            agentActionName,
            modelName: config.name || null,
            maxTokens: config.max_tokens || null,
            temperature: config.temperature !== undefined ? config.temperature : null,
            reasoningEffort: config.reasoning_effort === 'minimal' ? 'low' : (config.reasoning_effort || null),
            providerOverride: config.providerOverride || null,
            fallbackModel: config.fallbackModel || null,
            isActive: true,
            updatedAt: new Date()
        };

        if (existingConfig.length > 0) {
            // Update existing config
            const updated = await this.db.db
                .update(userModelConfigs)
                .set(configData)
                .where(eq(userModelConfigs.id, existingConfig[0].id))
                .returning();
            
            return updated[0];
        } else {
            // Create new config
            const newConfig: NewUserModelConfig = {
                id: generateId(),
                ...configData,
                createdAt: new Date()
            } as NewUserModelConfig;

            const created = await this.db.db
                .insert(userModelConfigs)
                .values(newConfig)
                .returning();
            
            return created[0];
        }
    }

    /**
     * Delete/reset a user model configuration (revert to default)
     */
    async deleteUserModelConfig(userId: string, agentActionName: AgentActionKey): Promise<boolean> {
        const result = await this.db.db
            .delete(userModelConfigs)
            .where(and(
                eq(userModelConfigs.userId, userId),
                eq(userModelConfigs.agentActionName, agentActionName)
            ));

        return (result.meta?.changes || 0) > 0;
    }

    /**
     * Get default configurations (from AGENT_CONFIG)
     */
    getDefaultConfigs(): Record<AgentActionKey, ModelConfig> {
        return AGENT_CONFIG;
    }

    /**
     * Check if user has any custom configurations
     */
    async hasUserOverrides(userId: string): Promise<boolean> {
        const count = await this.db.db
            .select({ count: userModelConfigs.id })
            .from(userModelConfigs)
            .where(and(
                eq(userModelConfigs.userId, userId),
                eq(userModelConfigs.isActive, true)
            ));

        return count.length > 0;
    }

    /**
     * Reset all user configurations to defaults
     */
    async resetAllUserConfigs(userId: string): Promise<number> {
        const result = await this.db.db
            .delete(userModelConfigs)
            .where(eq(userModelConfigs.userId, userId));

        return result.meta?.changes || 0;
    }
}