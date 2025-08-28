import { describe, it, expect, beforeEach } from 'vitest';
import { PasswordService } from './passwordService';

describe('PasswordService', () => {
    let passwordService: PasswordService;

    beforeEach(() => {
        passwordService = new PasswordService();
    });

    describe('hash', () => {
        it('should hash a password', async () => {
            const password = 'SecurePassword123!';
            const hash = await passwordService.hash(password);

            expect(hash).toBeTruthy();
            expect(typeof hash).toBe('string');
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(50); // PBKDF2 with salt produces long hashes
        });

        it('should produce different hashes for the same password', async () => {
            const password = 'SecurePassword123!';
            const hash1 = await passwordService.hash(password);
            const hash2 = await passwordService.hash(password);

            expect(hash1).not.toBe(hash2); // Different salts
        });

        it('should handle empty password', async () => {
            const password = '';
            const hash = await passwordService.hash(password);

            expect(hash).toBeTruthy();
            expect(typeof hash).toBe('string');
        });

        it('should handle very long passwords', async () => {
            const password = 'a'.repeat(1000);
            const hash = await passwordService.hash(password);

            expect(hash).toBeTruthy();
            expect(typeof hash).toBe('string');
        });

        it('should handle special characters', async () => {
            const password = '!@#$%^&*()_+-=[]{}|;:,.<>?~`"\'/\\';
            const hash = await passwordService.hash(password);

            expect(hash).toBeTruthy();
            expect(typeof hash).toBe('string');
        });

        it('should handle unicode characters', async () => {
            const password = '密码🔐パスワード';
            const hash = await passwordService.hash(password);

            expect(hash).toBeTruthy();
            expect(typeof hash).toBe('string');
        });
    });

    describe('verify', () => {
        it('should verify correct password', async () => {
            const password = 'SecurePassword123!';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify(password, hash);

            expect(isValid).toBe(true);
        });

        it('should reject incorrect password', async () => {
            const password = 'SecurePassword123!';
            const wrongPassword = 'WrongPassword123!';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify(wrongPassword, hash);

            expect(isValid).toBe(false);
        });

        it('should handle empty password verification', async () => {
            const password = '';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify(password, hash);

            expect(isValid).toBe(true);
        });

        it('should reject empty password against non-empty hash', async () => {
            const password = 'SecurePassword123!';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify('', hash);

            expect(isValid).toBe(false);
        });

        it('should handle case sensitivity', async () => {
            const password = 'SecurePassword123!';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify('securepassword123!', hash);

            expect(isValid).toBe(false);
        });

        it('should handle whitespace differences', async () => {
            const password = 'SecurePassword123!';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify(' SecurePassword123! ', hash);

            expect(isValid).toBe(false);
        });

        it('should handle invalid hash format gracefully', async () => {
            const password = 'SecurePassword123!';
            const invalidHash = 'invalid-hash-format';
            
            const isValid = await passwordService.verify(password, invalidHash);
            expect(isValid).toBe(false);
        });

        it('should handle malformed hash gracefully', async () => {
            const password = 'SecurePassword123!';
            const malformedHash = 'salt:hash'; // Missing iterations
            
            const isValid = await passwordService.verify(password, malformedHash);
            expect(isValid).toBe(false);
        });

        it('should verify passwords with special characters', async () => {
            const password = '!@#$%^&*()_+-=[]{}|;:,.<>?~`"\'/\\';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify(password, hash);

            expect(isValid).toBe(true);
        });

        it('should verify unicode passwords', async () => {
            const password = '密码🔐パスワード';
            const hash = await passwordService.hash(password);
            const isValid = await passwordService.verify(password, hash);

            expect(isValid).toBe(true);
        });
    });


    describe('constant time comparison', () => {
        it('should correctly compare equal hashes', async () => {
            const password = 'SecurePassword123!';
            const hash1 = await passwordService.hash(password);
            const hash2 = hash1; // Same hash
            
            const isValid = await passwordService.verify(password, hash2);
            expect(isValid).toBe(true);
        });

        it('should handle timing attack attempts', async () => {
            const password = 'SecurePassword123!';
            const hash = await passwordService.hash(password);
            
            // Attempt to verify with slightly different passwords
            const attempts = [
                'SecurePassword123',
                'SecurePassword123!!',
                'SecurePassword1234!',
                'securePassword123!',
            ];
            
            for (const attempt of attempts) {
                const isValid = await passwordService.verify(attempt, hash);
                expect(isValid).toBe(false);
            }
        });
    });
});