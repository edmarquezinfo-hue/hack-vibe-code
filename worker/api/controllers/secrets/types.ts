/**
 * Type definitions for Secrets Controller responses
 */

import type { EncryptedSecret } from '../../../database/types';
import { SecretTemplate } from '../../../types/secretsTemplates';

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
 * Response data for getTemplates
 * Uses existing types directly - no duplication
 */
export interface SecretTemplatesData {
    templates: SecretTemplate[];
}