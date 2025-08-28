/**
 * Login Flow Tests
 * Test user login functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils } from '../setup';

describe('Login Flow', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let testUser: any;

  beforeEach(async () => {
    // Setup test environment
    env = getMiniflareBindings();
    ctx = new ExecutionContext();
    
    // Create a test user
    testUser = testUtils.generateTestUser();
    await fetch('http://localhost:8787/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await fetch('http://localhost:8787/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(testUser.email);
      
      // Check cookies
      const cookies = testUtils.parseCookies(response);
      expect(cookies.accessToken).toBeDefined();
      expect(cookies.refreshToken).toBeDefined();
    });

    it('should reject login with invalid password', async () => {
      const response = await fetch('http://localhost:8787/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: 'WrongPassword123!',
        }),
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Invalid email or password');
    });

    it('should reject login with non-existent email', async () => {
      const response = await fetch('http://localhost:8787/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'AnyPassword123!',
        }),
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('Invalid email or password');
    });

    it('should handle case-insensitive email', async () => {
      const response = await fetch('http://localhost:8787/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email.toUpperCase(),
          password: testUser.password,
        }),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testUser.email.toLowerCase());
    });

    it('should track login attempts', async () => {
      // Make multiple failed login attempts
      for (let i = 0; i < 3; i++) {
        await fetch('http://localhost:8787/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: testUser.email,
            password: 'WrongPassword',
          }),
        });
      }

      // Successful login should still work (rate limiting disabled in test)
      const response = await fetch('http://localhost:8787/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Authentication State', () => {
    it('should maintain session after login', async () => {
      // Login
      const loginResponse = await fetch('http://localhost:8787/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      const cookies = testUtils.parseCookies(loginResponse);
      
      // Check auth status
      const checkResponse = await fetch('http://localhost:8787/api/auth/check', {
        headers: {
          'Cookie': `accessToken=${cookies.accessToken}`,
        },
      });

      expect(checkResponse.status).toBe(200);
      
      const data = await checkResponse.json();
      expect(data.data.authenticated).toBe(true);
      expect(data.data.user).toBeDefined();
    });

    it('should reject requests with invalid token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/check', {
        headers: {
          'Cookie': 'accessToken=invalid-token',
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.authenticated).toBe(false);
    });

    it('should handle missing token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/check');

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.authenticated).toBe(false);
    });
  });
});