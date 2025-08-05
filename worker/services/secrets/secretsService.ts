/**
 * Secrets Service
 * Handles encryption/decryption and management of user API keys and secrets
 */

import { DatabaseService } from '../../database/database';
import * as schema from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { createLogger } from '../../logger';

const logger = createLogger('SecretsService');

export interface SecretData {
    id?: string;
    name: string;
    provider: string;
    secretType: string;
    value: string;
    environment?: string;
    description?: string;
    expiresAt?: Date;
}

export interface EncryptedSecret {
    id: string;
    userId: string;
    name: string;
    provider: string;
    secretType: string;
    keyPreview: string;
    environment: string;
    description?: string;
    expiresAt?: Date;
    lastUsed?: Date;
    usageCount: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export class SecretsService {
    constructor(
        private db: DatabaseService,
        private env: Env
    ) {}

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
            logger.error('Failed to encrypt secret', error);
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
            logger.error('Failed to decrypt secret', error);
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
                id: crypto.randomUUID(),
                userId,
                name: secretData.name,
                provider: secretData.provider,
                secretType: secretData.secretType,
                encryptedValue,
                keyPreview,
                environment: secretData.environment || 'production',
                description: secretData.description,
                expiresAt: secretData.expiresAt,
                isActive: true,
                usageCount: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            await this.db.db.insert(schema.userSecrets).values(newSecret);

            logger.info('Secret stored successfully', { 
                userId, 
                provider: secretData.provider, 
                secretType: secretData.secretType 
            });

            // Return without encrypted value
            return this.formatSecretResponse(newSecret);
        } catch (error) {
            logger.error('Failed to store secret', error);
            throw error;
        }
    }

    /**
     * Get all secrets for a user (without decrypted values)
     */
    async getUserSecrets(userId: string): Promise<EncryptedSecret[]> {
        try {
            const secrets = await this.db.db
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
            logger.error('Failed to get user secrets', error);
            throw error;
        }
    }

    /**
     * Get decrypted secret value (for code generation use)
     */
    async getSecretValue(userId: string, secretId: string): Promise<string> {
        try {
            const secret = await this.db.db
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
            await this.db.db
                .update(schema.userSecrets)
                .set({
                    lastUsed: new Date(),
                    usageCount: (secret.usageCount || 0) + 1
                })
                .where(eq(schema.userSecrets.id, secretId));

            return await this.decryptSecret(secret.encryptedValue);
        } catch (error) {
            logger.error('Failed to get secret value', error);
            throw error;
        }
    }

    /**
     * Delete a secret
     */
    async deleteSecret(userId: string, secretId: string): Promise<void> {
        try {
            await this.db.db
                .update(schema.userSecrets)
                .set({
                    isActive: false,
                    updatedAt: new Date()
                })
                .where(
                    and(
                        eq(schema.userSecrets.id, secretId),
                        eq(schema.userSecrets.userId, userId)
                    )
                );

            logger.info('Secret deleted successfully', { userId, secretId });
        } catch (error) {
            logger.error('Failed to delete secret', error);
            throw error;
        }
    }

    /**
     * Format secret response (remove sensitive data)
     */
    private formatSecretResponse(secret: any): EncryptedSecret {
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