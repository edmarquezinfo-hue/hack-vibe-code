/**
 * Password Service using Web Crypto API
 * Provides secure password hashing and validation
 */

import { PasswordValidationResult } from '../../types/auth-types';
import { validatePassword } from '../../utils/validationUtils';
import { createLogger } from '../../logger';

const logger = createLogger('PasswordService');

/**
 * Password Service for secure password operations
 * Uses PBKDF2 with Web Crypto API (since Argon2 is not available in Workers)
 */
export class PasswordService {
    private readonly saltLength = 16;
    private readonly iterations = 100000; // OWASP recommended minimum
    private readonly keyLength = 32; // 256 bits
    
    /**
     * Hash a password
     */
    async hash(password: string): Promise<string> {
        try {
            // Generate salt
            const salt = crypto.getRandomValues(new Uint8Array(this.saltLength));
            
            // Hash password
            const hash = await this.pbkdf2(password, salt);
            
            // Combine salt and hash for storage
            const combined = new Uint8Array(salt.length + hash.length);
            combined.set(salt);
            combined.set(hash, salt.length);
            
            // Encode as base64
            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            logger.error('Error hashing password', error);
            throw new Error('Failed to hash password');
        }
    }
    
    /**
     * Verify a password against a hash
     */
    async verify(password: string, hashedPassword: string): Promise<boolean> {
        try {
            // Decode from base64
            const combined = Uint8Array.from(atob(hashedPassword), c => c.charCodeAt(0));
            
            // Extract salt and hash
            const salt = combined.slice(0, this.saltLength);
            const originalHash = combined.slice(this.saltLength);
            
            // Hash the provided password with the same salt
            const newHash = await this.pbkdf2(password, salt);
            
            // Compare hashes
            return this.timingSafeEqual(originalHash, newHash);
        } catch (error) {
            logger.error('Error verifying password', error);
            return false;
        }
    }
    
    /**
     * Validate password strength using centralized validation
     */
    validatePassword(password: string, userInfo?: { email?: string; name?: string }): PasswordValidationResult {
        return validatePassword(password, undefined, userInfo);
    }
    
    /**
     * Generate a secure random password
     */
    generatePassword(length: number = 16): string {
        const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        const values = crypto.getRandomValues(new Uint8Array(length));
        
        let password = '';
        for (let i = 0; i < length; i++) {
            password += charset[values[i] % charset.length];
        }
        
        return password;
    }
    
    /**
     * PBKDF2 implementation using Web Crypto API
     */
    private async pbkdf2(password: string, salt: Uint8Array): Promise<Uint8Array> {
        const encoder = new TextEncoder();
        
        // Import password as key
        const passwordKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits']
        );
        
        // Derive bits
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt,
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            passwordKey,
            this.keyLength * 8 // bits
        );
        
        return new Uint8Array(derivedBits);
    }
    
    /**
     * Timing-safe comparison
     */
    private timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
        if (a.length !== b.length) {
            return false;
        }
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a[i] ^ b[i];
        }
        
        return result === 0;
    }
    
}