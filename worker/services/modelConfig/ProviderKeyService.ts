/**
 * Provider Key Service
 * Handles encrypted storage and management of user API keys for AI providers
 */

import { DatabaseService } from '../../database/database';
import { UserProviderKey, NewUserProviderKey, userProviderKeys } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '../../utils/idGenerator';

export interface ProviderKeyData {
    id: string;
    provider: string;
    keyPreview: string;
    lastTested?: Date;
    testStatus?: 'success' | 'failed' | 'pending';
    testError?: string;
    isActive: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
}

export interface TestResult {
    success: boolean;
    error?: string;
    model?: string;
    latencyMs?: number;
}

export class ProviderKeyService {
    constructor(private db: DatabaseService, private env: Env) {}

    /**
     * Encrypt API key using AES-256
     */
    private async encryptApiKey(apiKey: string): Promise<string> {
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(this.env.JWT_SECRET || 'default-secret-key-for-dev-only'),
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );

        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedText = new TextEncoder().encode(apiKey);

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encodedText
        );

        const encryptedArray = new Uint8Array(encrypted);
        const combined = new Uint8Array(iv.length + encryptedArray.length);
        combined.set(iv);
        combined.set(encryptedArray, iv.length);

        return btoa(String.fromCharCode(...combined));
    }

    /**
     * Decrypt API key
     */
    private async decryptApiKey(encryptedData: string): Promise<string> {
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(this.env.JWT_SECRET || 'default-secret-key-for-dev-only'),
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );

        const combined = new Uint8Array(
            atob(encryptedData)
                .split('')
                .map(char => char.charCodeAt(0))
        );

        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    }

    /**
     * Generate key preview (first 4 and last 4 characters)
     */
    private generateKeyPreview(apiKey: string): string {
        if (apiKey.length <= 8) {
            return apiKey.substring(0, 2) + '...' + apiKey.substring(apiKey.length - 2);
        }
        return apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
    }

    /**
     * Get all provider keys for a user (without decrypted values)
     */
    async getUserProviderKeys(userId: string): Promise<ProviderKeyData[]> {
        const keys = await this.db.db
            .select({
                id: userProviderKeys.id,
                provider: userProviderKeys.provider,
                keyPreview: userProviderKeys.keyPreview,
                lastTested: userProviderKeys.lastTested,
                testStatus: userProviderKeys.testStatus,
                testError: userProviderKeys.testError,
                isActive: userProviderKeys.isActive,
                createdAt: userProviderKeys.createdAt,
                updatedAt: userProviderKeys.updatedAt,
            })
            .from(userProviderKeys)
            .where(and(
                eq(userProviderKeys.userId, userId),
                eq(userProviderKeys.isActive, true)
            ));

        return keys.map(key => ({
            id: key.id,
            provider: key.provider,
            keyPreview: key.keyPreview,
            lastTested: key.lastTested || undefined,
            testStatus: key.testStatus as any || undefined,
            testError: key.testError || undefined,
            isActive: Boolean(key.isActive),
            createdAt: key.createdAt,
            updatedAt: key.updatedAt,
        }));
    }

    /**
     * Get decrypted API key for a specific provider
     */
    async getDecryptedApiKey(userId: string, provider: string): Promise<string | null> {
        const keyRecord = await this.db.db
            .select()
            .from(userProviderKeys)
            .where(and(
                eq(userProviderKeys.userId, userId),
                eq(userProviderKeys.provider, provider),
                eq(userProviderKeys.isActive, true)
            ))
            .limit(1);

        if (keyRecord.length === 0) {
            return null;
        }

        try {
            return await this.decryptApiKey(keyRecord[0].encryptedApiKey);
        } catch (error) {
            console.error(`Failed to decrypt API key for provider ${provider}:`, error);
            return null;
        }
    }

    /**
     * Set or update a provider API key
     */
    async setProviderKey(userId: string, provider: string, apiKey: string): Promise<UserProviderKey> {
        const encryptedKey = await this.encryptApiKey(apiKey);
        const keyPreview = this.generateKeyPreview(apiKey);
        
        const existingKey = await this.db.db
            .select()
            .from(userProviderKeys)
            .where(and(
                eq(userProviderKeys.userId, userId),
                eq(userProviderKeys.provider, provider)
            ))
            .limit(1);

        const keyData: Partial<NewUserProviderKey> = {
            userId,
            provider,
            encryptedApiKey: encryptedKey,
            keyPreview,
            testStatus: 'pending',
            isActive: true,
            updatedAt: new Date()
        };

        if (existingKey.length > 0) {
            // Update existing key
            const updated = await this.db.db
                .update(userProviderKeys)
                .set(keyData)
                .where(eq(userProviderKeys.id, existingKey[0].id))
                .returning();
            
            return updated[0];
        } else {
            // Create new key
            const newKey: NewUserProviderKey = {
                id: generateId(),
                ...keyData,
                createdAt: new Date()
            } as NewUserProviderKey;

            const created = await this.db.db
                .insert(userProviderKeys)
                .values(newKey)
                .returning();
            
            return created[0];
        }
    }

    /**
     * Delete a provider key
     */
    async deleteProviderKey(userId: string, provider: string): Promise<boolean> {
        const result = await this.db.db
            .delete(userProviderKeys)
            .where(and(
                eq(userProviderKeys.userId, userId),
                eq(userProviderKeys.provider, provider)
            ));

        return (result.meta?.changes || 0) > 0;
    }

    /**
     * Update test status for a provider key
     */
    async updateTestStatus(
        userId: string, 
        provider: string, 
        testResult: TestResult
    ): Promise<boolean> {
        const result = await this.db.db
            .update(userProviderKeys)
            .set({
                testStatus: testResult.success ? 'success' : 'failed',
                testError: testResult.error || null,
                lastTested: new Date(),
                updatedAt: new Date()
            })
            .where(and(
                eq(userProviderKeys.userId, userId),
                eq(userProviderKeys.provider, provider)
            ));

        return (result.meta?.changes || 0) > 0;
    }

    /**
     * Get all user API keys as a map (provider -> decrypted key)
     * Used by inference system to override environment variables
     */
    async getUserProviderKeysMap(userId: string): Promise<Map<string, string>> {
        const keys = await this.db.db
            .select()
            .from(userProviderKeys)
            .where(and(
                eq(userProviderKeys.userId, userId),
                eq(userProviderKeys.isActive, true)
            ));

        const keyMap = new Map<string, string>();
        
        for (const key of keys) {
            try {
                const decryptedKey = await this.decryptApiKey(key.encryptedApiKey);
                keyMap.set(key.provider, decryptedKey);
            } catch (error) {
                console.error(`Failed to decrypt key for provider ${key.provider}:`, error);
            }
        }

        return keyMap;
    }
}