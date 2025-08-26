/**
 * Secrets Service
 * Handles encryption/decryption and management of user API keys and secrets
 * Moved from /services/secrets/ to maintain consistent database service patterns
 */

import { BaseService } from './BaseService';
import * as schema from '../schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';
import type { SecretData, EncryptedSecret } from '../types';
import { DatabaseService } from '../database';
import { getBYOKTemplates } from '../../types/secretsTemplates';

export class SecretsService extends BaseService {
    constructor(
        db: DatabaseService,
        private env: Env
    ) {
        super(db);
    }

    /**
     * Encrypt a secret value using AES-256-GCM
     */
    private async encryptSecret(value: string): Promise<{ encryptedValue: string; keyPreview: string }> {
        try {
            // Use JWT_SECRET as encryption key for simplicity
            // In production, you'd want a separate encryption key
            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(this.env.JWT_SECRET.substring(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );

            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encodedValue = new TextEncoder().encode(value);

            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                encodedValue
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            const encryptedValue = btoa(String.fromCharCode(...combined));
            
            // Create preview (first 4 + last 4 characters, masked middle)
            const keyPreview = value.length > 8 
                ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
                : `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;

            return { encryptedValue, keyPreview };
        } catch (error) {
            this.logger.error('Failed to encrypt secret', error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypt a secret value
     */
    private async decryptSecret(encryptedValue: string): Promise<string> {
        try {
            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(this.env.JWT_SECRET.substring(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const combined = new Uint8Array(
                atob(encryptedValue).split('').map(char => char.charCodeAt(0))
            );

            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            this.logger.error('Failed to decrypt secret', error);
            throw new Error('Decryption failed');
        }
    }

    /**
     * Store a new secret for a user
     */
    async storeSecret(userId: string, secretData: SecretData): Promise<EncryptedSecret> {
        try {
            // Validate input
            if (!secretData.value || !secretData.provider || !secretData.secretType) {
                throw new Error('Missing required secret data');
            }

            // Encrypt the secret value
            const { encryptedValue, keyPreview } = await this.encryptSecret(secretData.value);

            // Store in database
            const newSecret = {
                id: generateId(),
                userId,
                name: secretData.name,
                provider: secretData.provider,
                secretType: secretData.secretType,
                encryptedValue,
                keyPreview,
                environment: secretData.environment || 'production',
                description: secretData.description ?? null,
                expiresAt: secretData.expiresAt ?? null,
                lastUsed: null,
                isActive: true,
                usageCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.database.insert(schema.userSecrets).values(newSecret);

            this.logger.info('Secret stored successfully', { 
                userId, 
                provider: secretData.provider, 
                secretType: secretData.secretType 
            });

            // Return without encrypted value
            return this.formatSecretResponse(newSecret);
        } catch (error) {
            this.logger.error('Failed to store secret', error);
            throw error;
        }
    }

    /**
     * Get all secrets for a user (without decrypted values)
     */
    async getUserSecrets(userId: string): Promise<EncryptedSecret[]> {
        try {
            const secrets = await this.database
                .select()
                .from(schema.userSecrets)
                .where(
                    and(
                        eq(schema.userSecrets.userId, userId),
                        eq(schema.userSecrets.isActive, true)
                    )
                )
                .orderBy(schema.userSecrets.createdAt);

            return secrets.map(secret => this.formatSecretResponse(secret));
        } catch (error) {
            this.logger.error('Failed to get user secrets', error);
            throw error;
        }
    }

    /**
     * Get all secrets for a user (both active and inactive) - for management purposes
     */
    async getAllUserSecrets(userId: string): Promise<EncryptedSecret[]> {
        try {
            const secrets = await this.database
                .select()
                .from(schema.userSecrets)
                .where(eq(schema.userSecrets.userId, userId))
                .orderBy(schema.userSecrets.createdAt);

            return secrets.map(secret => this.formatSecretResponse(secret));
        } catch (error) {
            this.logger.error('Failed to get all user secrets', error);
            throw error;
        }
    }

    /**
     * Get decrypted secret value (for code generation use)
     */
    async getSecretValue(userId: string, secretId: string): Promise<string> {
        try {
            const secret = await this.database
                .select()
                .from(schema.userSecrets)
                .where(
                    and(
                        eq(schema.userSecrets.id, secretId),
                        eq(schema.userSecrets.userId, userId),
                        eq(schema.userSecrets.isActive, true)
                    )
                )
                .get();

            if (!secret) {
                throw new Error('Secret not found');
            }

            // Update last used
            await this.database
                .update(schema.userSecrets)
                .set({
                    lastUsed: new Date(),
                    usageCount: (secret.usageCount || 0) + 1
                })
                .where(eq(schema.userSecrets.id, secretId));

            return await this.decryptSecret(secret.encryptedValue);
        } catch (error) {
            this.logger.error('Failed to get secret value', error);
            throw error;
        }
    }

    /**
     * Delete a secret permanently
     */
    async deleteSecret(userId: string, secretId: string): Promise<void> {
        try {
            await this.database
                .delete(schema.userSecrets)
                .where(
                    and(
                        eq(schema.userSecrets.id, secretId),
                        eq(schema.userSecrets.userId, userId)
                    )
                );

            this.logger.info('Secret deleted successfully', { userId, secretId });
        } catch (error) {
            this.logger.error('Failed to delete secret', error);
            throw error;
        }
    }

    /**
     * Get BYOK (Bring Your Own Key) API keys as a map (provider -> decrypted key)
     * Uses dynamic template discovery for future-proof provider support
     */
    async getUserBYOKKeysMap(userId: string): Promise<Map<string, string>> {
        try {
            // Get BYOK templates dynamically
            const byokTemplates = getBYOKTemplates();
            
            // Get all user secrets
            const secrets = await this.database
                .select()
                .from(schema.userSecrets)
                .where(
                    and(
                        eq(schema.userSecrets.userId, userId),
                        eq(schema.userSecrets.isActive, true)
                    )
                );

            const keyMap = new Map<string, string>();
            
            // Match secrets to BYOK templates
            for (const template of byokTemplates) {
                const secret = secrets.find(s => s.secretType === template.envVarName);
                
                if (secret) {
                    try {
                        const decryptedKey = await this.decryptSecret(secret.encryptedValue);
                        keyMap.set(template.provider, decryptedKey);
                    } catch (error) {
                        this.logger.error(`Failed to decrypt BYOK key for provider ${template.provider}:`, error);
                    }
                }
            }

            this.logger.info(`Loaded ${keyMap.size} BYOK API keys from secrets system`, { userId });
            return keyMap;
        } catch (error) {
            this.logger.error('Failed to get user BYOK keys map', error);
            return new Map();
        }
    }

    /**
     * Get legacy API keys (secretType = 'API_KEY') as a map
     * Maintains backward compatibility
     */
    async getLegacyAPIKeysMap(userId: string): Promise<Map<string, string>> {
        try {
            const secrets = await this.database
                .select()
                .from(schema.userSecrets)
                .where(
                    and(
                        eq(schema.userSecrets.userId, userId),
                        eq(schema.userSecrets.isActive, true),
                        eq(schema.userSecrets.secretType, 'API_KEY') // Only legacy API keys
                    )
                );

            const keyMap = new Map<string, string>();
            
            for (const secret of secrets) {
                try {
                    const decryptedKey = await this.decryptSecret(secret.encryptedValue);
                    keyMap.set(secret.provider, decryptedKey);
                } catch (error) {
                    this.logger.error(`Failed to decrypt legacy key for provider ${secret.provider}:`, error);
                }
            }

            return keyMap;
        } catch (error) {
            this.logger.error('Failed to get legacy user provider keys map', error);
            return new Map();
        }
    }

    /**
     * Get all user API keys as a map (provider -> decrypted key)
     * Used by inference system to override environment variables
     * Combines legacy keys and BYOK keys (BYOK takes precedence)
     */
    async getUserProviderKeysMap(userId: string): Promise<Map<string, string>> {
        try {
            // Get both legacy and BYOK keys in parallel
            const [legacyKeys, byokKeys] = await Promise.all([
                this.getLegacyAPIKeysMap(userId),
                this.getUserBYOKKeysMap(userId)
            ]);

            // Combine maps with BYOK keys taking precedence
            const combinedMap = new Map([...legacyKeys, ...byokKeys]);

            this.logger.info(`Loaded ${combinedMap.size} user API keys from secrets system (${legacyKeys.size} legacy, ${byokKeys.size} BYOK)`, { userId });
            return combinedMap;
        } catch (error) {
            this.logger.error('Failed to get user provider keys map', error);
            return new Map();
        }
    }

    /**
     * Toggle secret active status
     */
    async toggleSecretActiveStatus(userId: string, secretId: string): Promise<EncryptedSecret> {
        try {
            // First get the current secret to check ownership and current status
            const [currentSecret] = await this.database
                .select()
                .from(schema.userSecrets)
                .where(
                    and(
                        eq(schema.userSecrets.id, secretId),
                        eq(schema.userSecrets.userId, userId)
                    )
                )
                .limit(1);

            if (!currentSecret) {
                throw new Error('Secret not found or access denied');
            }

            // Toggle the status
            const newActiveStatus = !currentSecret.isActive;
            
            // Update the secret
            const [updatedSecret] = await this.database
                .update(schema.userSecrets)
                .set({
                    isActive: newActiveStatus,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(schema.userSecrets.id, secretId),
                        eq(schema.userSecrets.userId, userId)
                    )
                )
                .returning();

            if (!updatedSecret) {
                throw new Error('Failed to update secret status');
            }

            this.logger.info(`Secret ${newActiveStatus ? 'activated' : 'deactivated'}`, { 
                userId, 
                secretId, 
                provider: updatedSecret.provider 
            });
            
            return this.formatSecretResponse(updatedSecret);
        } catch (error) {
            this.logger.error('Failed to toggle secret active status', error);
            throw error;
        }
    }

    /**
     * Format secret response (remove sensitive data)
     */
    private formatSecretResponse(secret: schema.UserSecret): EncryptedSecret {
        return {
            id: secret.id,
            userId: secret.userId,
            name: secret.name,
            provider: secret.provider,
            secretType: secret.secretType,
            keyPreview: secret.keyPreview,
            environment: secret.environment,
            description: secret.description,
            expiresAt: secret.expiresAt,
            lastUsed: secret.lastUsed,
            usageCount: secret.usageCount,
            isActive: secret.isActive,
            createdAt: secret.createdAt,
            updatedAt: secret.updatedAt
        };
    }
}