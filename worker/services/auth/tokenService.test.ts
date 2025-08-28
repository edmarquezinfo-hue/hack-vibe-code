import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from './tokenService';

describe('TokenService', () => {
    let tokenService: TokenService;
    let mockEnv: Env;

    beforeEach(() => {
        // Mock environment with test JWT secret
        mockEnv = {
            JWT_SECRET: 'test-jwt-secret-key-that-is-at-least-256-bits-long',
        } as Env;

        tokenService = new TokenService(mockEnv);
    });

    describe('createToken', () => {
        it('should generate a valid access token', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            
            const token = await tokenService.createToken({
                sub: userId,
                email,
                type: 'access'
            });
            
            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
        });

        it('should include correct payload in access token', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            
            const token = await tokenService.createToken({
                sub: userId,
                email,
                type: 'access'
            });
            const payload = await tokenService.verifyToken(token);
            
            expect(payload).toBeTruthy();
            expect(payload?.sub).toBe(userId);
            expect(payload?.email).toBe(email);
            expect(payload?.type).toBe('access');
        });
    });

    describe('createTokenPair', () => {
        it('should generate valid access and refresh tokens', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            
            const result = await tokenService.createTokenPair(userId, email);
            
            expect(result.accessToken).toBeTruthy();
            expect(result.refreshToken).toBeTruthy();
            expect(result.expiresIn).toBe(3600);
            expect(result.accessToken.split('.')).toHaveLength(3);
            expect(result.refreshToken.split('.')).toHaveLength(3);
        });

        it('should include correct payload in tokens', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            
            const result = await tokenService.createTokenPair(userId, email);
            const accessPayload = await tokenService.verifyToken(result.accessToken);
            const refreshPayload = await tokenService.verifyToken(result.refreshToken);
            
            // Access token checks
            expect(accessPayload).toBeTruthy();
            expect(accessPayload?.sub).toBe(userId);
            expect(accessPayload?.email).toBe(email);
            expect(accessPayload?.type).toBe('access');
            
            // Refresh token checks
            expect(refreshPayload).toBeTruthy();
            expect(refreshPayload?.sub).toBe(userId);
            expect(refreshPayload?.email).toBe(email);
            expect(refreshPayload?.type).toBe('refresh');
            expect(refreshPayload?.jti).toBeTruthy(); // Refresh tokens should have JTI
        });
    });

    describe('verifyToken', () => {
        it('should verify a valid access token', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            const token = await tokenService.createToken({
                sub: userId,
                email,
                type: 'access'
            });
            
            const payload = await tokenService.verifyToken(token);
            
            expect(payload).toBeTruthy();
            expect(payload?.sub).toBe(userId);
            expect(payload?.type).toBe('access');
        });

        it('should reject an expired token', async () => {
            // Create token with -1 second expiry (already expired)
            const token = await tokenService.createToken({
                sub: 'test',
                email: 'test@example.com',
                type: 'access'
            }, -1); // Already expired
            
            const payload = await tokenService.verifyToken(token);
            
            expect(payload).toBeNull();
        });

        it('should reject a token with invalid signature', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            const token = await tokenService.createToken({
                sub: userId,
                email,
                type: 'access'
            });
            
            // Tamper with signature
            const parts = token.split('.');
            const tamperedToken = `${parts[0]}.${parts[1]}.invalidsignature`;
            
            const payload = await tokenService.verifyToken(tamperedToken);
            
            expect(payload).toBeNull();
        });

        it('should verify both access and refresh tokens', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            const { accessToken, refreshToken } = await tokenService.createTokenPair(userId, email);
            
            const accessPayload = await tokenService.verifyToken(accessToken);
            const refreshPayload = await tokenService.verifyToken(refreshToken);
            
            expect(accessPayload?.type).toBe('access');
            expect(refreshPayload?.type).toBe('refresh');
        });
    });

    describe('refreshAccessToken', () => {
        it('should refresh access token with valid refresh token', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            const { refreshToken } = await tokenService.createTokenPair(userId, email);
            
            const result = await tokenService.refreshAccessToken(refreshToken);
            
            expect(result).toBeTruthy();
            expect(result?.accessToken).toBeTruthy();
            expect(result?.expiresIn).toBe(3600);
            
            // Verify the new access token
            const payload = await tokenService.verifyToken(result!.accessToken);
            expect(payload?.sub).toBe(userId);
            expect(payload?.email).toBe(email);
            expect(payload?.type).toBe('access');
        });

        it('should reject an access token as refresh token', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            const { accessToken } = await tokenService.createTokenPair(userId, email);
            
            const result = await tokenService.refreshAccessToken(accessToken);
            
            expect(result).toBeNull();
        });

        it('should reject an invalid refresh token', async () => {
            const invalidToken = 'invalid.refresh.token';
            
            const result = await tokenService.refreshAccessToken(invalidToken);
            
            expect(result).toBeNull();
        });
    });

    describe('token expiration', () => {
        it('should set correct expiration for access token (1 hour)', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            const { accessToken } = await tokenService.createTokenPair(userId, email);
            
            const payload = await tokenService.verifyToken(accessToken);
            
            expect(payload).toBeTruthy();
            if (payload && payload.iat && payload.exp) {
                const expiryTime = payload.exp - payload.iat;
                expect(expiryTime).toBe(60 * 60); // 1 hour in seconds
            }
        });

        it('should set correct expiration for refresh token (7 days)', async () => {
            const userId = 'test-user-123';
            const email = 'test@example.com';
            const { refreshToken } = await tokenService.createTokenPair(userId, email);
            
            const payload = await tokenService.verifyToken(refreshToken);
            
            expect(payload).toBeTruthy();
            if (payload && payload.iat && payload.exp) {
                const expiryTime = payload.exp - payload.iat;
                expect(expiryTime).toBe(7 * 24 * 60 * 60); // 7 days in seconds
            }
        });
    });

    describe('edge cases', () => {
        it('should handle missing JWT_SECRET', async () => {
            const invalidEnv = {} as Env;
            
            expect(() => new TokenService(invalidEnv)).toThrow('JWT_SECRET not configured');
        });

        it('should handle malformed tokens', async () => {
            const malformedTokens = [
                'not.a.token',
                'invalid',
                '',
                'a.b', // Only 2 parts
                'a.b.c.d' // Too many parts
            ];
            
            for (const token of malformedTokens) {
                const payload = await tokenService.verifyToken(token);
                expect(payload).toBeNull();
            }
        });
    });

    describe('additional methods', () => {
        it('should generate secure random tokens', async () => {
            const token1 = await tokenService.generateSecureToken();
            const token2 = await tokenService.generateSecureToken();
            
            expect(token1).toBeTruthy();
            expect(token2).toBeTruthy();
            expect(token1).not.toBe(token2); // Should be unique
            expect(token1.length).toBeGreaterThan(20); // Should be reasonably long
        });

        it('should hash tokens consistently', async () => {
            const token = 'test-token-to-hash';
            
            const hash1 = await tokenService.hashToken(token);
            const hash2 = await tokenService.hashToken(token);
            
            expect(hash1).toBeTruthy();
            expect(hash1).toBe(hash2); // Same input should produce same hash
        });
    });
});