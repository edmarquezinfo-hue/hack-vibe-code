/**
 * Type definitions for Secrets Controller responses
 */

import type { EncryptedSecret } from '../../../database/types';

/**
 * Response data for getSecrets
 */
export interface SecretsData {
    secrets: EncryptedSecret[];
}

/**
 * Response data for storeSecret
 * Uses existing types directly - no duplication
 */
export interface SecretStoreData {
    secret: EncryptedSecret;
    message: string;
}

/**
 * Response data for deleteSecret
 * Simple message response
 */
export interface SecretDeleteData {
    message: string;
}

/**
 * Secret template interface for getTemplates
 * Matches the structure used in the controller
 */
export interface SecretTemplate {
    id: string;
    displayName: string;
    envVarName: string;
    provider: string;
    icon: string;
    description: string;
    instructions: string;
    placeholder: string;
    validation: string;
    required: boolean;
    category: string;
}

/**
 * Response data for getTemplates
 * Uses existing types directly - no duplication
 */
export interface SecretTemplatesData {
    templates: SecretTemplate[];
}