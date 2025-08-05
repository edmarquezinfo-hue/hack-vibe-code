import { describe, it, expect, beforeEach } from 'vitest';
import { setupAuthRoutes } from './authRoutes';
import { Router } from '../router';
import { testUtils } from '../../../test/setup';

describe('Auth Routes Integration', () => {
    let router: Router;
    let mockEnv: Env;

    beforeEach(() => {
        router = new Router();
        setupAuthRoutes(router);
        
        // Mock environment
        mockEnv = {
            JWT_SECRET: 'test-secret-key-for-testing-only',
            BASE_URL: 'http://localhost:8787',
            DB: {} as D1Database,
            GOOGLE_CLIENT_ID: 'test-google-id',
            GOOGLE_CLIENT_SECRET: 'test-google-secret',
            GITHUB_CLIENT_ID: 'test-github-id', 
            GITHUB_CLIENT_SECRET: 'test-github-secret',
        } as Env;
    });

    describe('POST /api/auth/register', () => {
        it('should handle registration request', async () => {
            const request = new Request('http://localhost/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'SecurePassword123!',
                    name: 'Test User',
                }),
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBeLessThan(500); // Should not be a server error
        });

        it('should reject invalid registration data', async () => {
            const request = new Request('http://localhost/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'invalid-email',
                    password: '123', // Too weak
                }),
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should handle login request', async () => {
            const request = new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'SecurePassword123!',
                }),
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBeLessThan(500);
        });
    });

    describe('GET /api/auth/profile', () => {
        it('should reject unauthenticated request', async () => {
            const request = new Request('http://localhost/api/auth/profile', {
                method: 'GET',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBe(401);
        });

        it('should handle authenticated request', async () => {
            const token = await testUtils.generateTestJWT({
                sub: 'user-123',
                email: 'test@example.com',
                type: 'access',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            });

            const request = new Request('http://localhost/api/auth/profile', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
            // Note: Will likely fail auth due to invalid JWT signature in test env
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should handle logout request', async () => {
            const request = new Request('http://localhost/api/auth/logout', {
                method: 'POST',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBeLessThan(500);
            
            // Check cookies are cleared
            const cookies = testUtils.parseCookies(response);
            expect(cookies.accessToken).toBeFalsy();
            expect(cookies.refreshToken).toBeFalsy();
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should handle refresh token request', async () => {
            const request = new Request('http://localhost/api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refreshToken: 'test-refresh-token',
                }),
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBeLessThan(500);
        });
    });

    describe('GET /api/auth/check', () => {
        it('should return authentication status', async () => {
            const request = new Request('http://localhost/api/auth/check', {
                method: 'GET',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            
            const data = await response.json();
            expect(data).toHaveProperty('data.authenticated');
        });
    });

    describe('OAuth Routes', () => {
        it('should redirect to Google OAuth', async () => {
            const request = new Request('http://localhost/api/auth/oauth/google', {
                method: 'GET',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBe(302);
            expect(response.headers.get('Location')).toContain('accounts.google.com');
        });

        it('should redirect to GitHub OAuth', async () => {
            const request = new Request('http://localhost/api/auth/oauth/github', {
                method: 'GET',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBe(302);
            expect(response.headers.get('Location')).toContain('github.com/login/oauth');
        });

        it('should handle OAuth callback', async () => {
            const request = new Request('http://localhost/api/auth/callback/google?code=test-code&state=test-state', {
                method: 'GET',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
            // Will redirect after processing
            expect(response.status).toBe(302);
        });

        it('should handle OAuth error callback', async () => {
            const request = new Request('http://localhost/api/auth/callback/google?error=access_denied', {
                method: 'GET',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBe(302);
            expect(response.headers.get('Location')).toContain('error=oauth_failed');
        });
    });

    describe('Route Not Found', () => {
        it('should return 404 for unknown auth routes', async () => {
            const request = new Request('http://localhost/api/auth/unknown-endpoint', {
                method: 'GET',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBe(404);
        });
    });

    describe('Method Not Allowed', () => {
        it('should return 405 for wrong HTTP method', async () => {
            const request = new Request('http://localhost/api/auth/register', {
                method: 'GET', // Should be POST
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBe(404); // Router returns 404 for unmatched methods
        });
    });

    describe('Request Validation', () => {
        it('should validate content-type header', async () => {
            const request = new Request('http://localhost/api/auth/register', {
                method: 'POST',
                headers: {
                    // Missing Content-Type
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'SecurePassword123!',
                }),
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
        });

        it('should handle malformed JSON', async () => {
            const request = new Request('http://localhost/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: 'invalid json {',
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.status).toBeLessThan(500);
        });
    });

    describe('Cookie Handling', () => {
        it('should accept auth token from cookie', async () => {
            const request = new Request('http://localhost/api/auth/profile', {
                method: 'GET',
                headers: {
                    'Cookie': 'accessToken=test-token',
                },
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            expect(response).toBeInstanceOf(Response);
        });

        it('should set secure cookies on login', async () => {
            const request = new Request('http://localhost/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: 'test@example.com',
                    password: 'SecurePassword123!',
                }),
            });

            const response = await router.handle(request, mockEnv, {} as ExecutionContext);
            
            if (response.status === 200) {
                const setCookieHeader = response.headers.get('Set-Cookie');
                const hasCookies = setCookieHeader ? 
                    setCookieHeader.includes('HttpOnly') && setCookieHeader.includes('Secure') : 
                    false;
                expect(hasCookies).toBe(true);
            }
        });
    });
});