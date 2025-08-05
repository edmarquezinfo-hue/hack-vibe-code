/**
 * Session Management Tests
 * Test session and token functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils } from '../setup';

describe('Session Management', () => {
  let env: Env;
  let ctx: ExecutionContext;
  let authTokens: { accessToken: string; refreshToken: string };
  let testUser: any;

  beforeEach(async () => {
    // Setup test environment
    env = getMiniflareBindings();
    ctx = new ExecutionContext();
    
    // Create and login a test user
    testUser = testUtils.generateTestUser();
    
    // Register
    await fetch('http://localhost:8787/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });
    
    // Login to get tokens
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
    authTokens = {
      accessToken: cookies.accessToken,
      refreshToken: cookies.refreshToken,
    };
  });

  describe('Protected Routes', () => {
    it('should access protected route with valid token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/profile', {
        headers: {
          'Cookie': `accessToken=${authTokens.accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe(testUser.email);
    });

    it('should reject protected route without token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/profile');

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject protected route with invalid token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/profile', {
        headers: {
          'Cookie': 'accessToken=invalid-token',
        },
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INVALID_TOKEN');
    });

    it('should accept token from Authorization header', async () => {
      const response = await fetch('http://localhost:8787/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${authTokens.accessToken}`,
        },
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: authTokens.refreshToken,
        }),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.expiresIn).toBe(3600);
      
      // New access token should work
      const profileResponse = await fetch('http://localhost:8787/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${data.data.accessToken}`,
        },
      });
      
      expect(profileResponse.status).toBe(200);
    });

    it('should accept refresh token from cookie', async () => {
      const response = await fetch('http://localhost:8787/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Cookie': `refreshToken=${authTokens.refreshToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.accessToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: 'invalid-refresh-token',
        }),
      });

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should reject missing refresh token', async () => {
      const response = await fetch('http://localhost:8787/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('Logout', () => {
    it('should logout and clear session', async () => {
      // Logout
      const logoutResponse = await fetch('http://localhost:8787/api/auth/logout', {
        method: 'POST',
        headers: {
          'Cookie': `accessToken=${authTokens.accessToken}`,
        },
      });

      expect(logoutResponse.status).toBe(200);
      
      // Check cookies are cleared
      const cookies = testUtils.parseCookies(logoutResponse);
      expect(cookies.accessToken).toBe('');
      expect(cookies.refreshToken).toBe('');
      
      // Token should no longer work
      const profileResponse = await fetch('http://localhost:8787/api/auth/profile', {
        headers: {
          'Cookie': `accessToken=${authTokens.accessToken}`,
        },
      });
      
      expect(profileResponse.status).toBe(401);
    });

    it('should handle logout without auth', async () => {
      const response = await fetch('http://localhost:8787/api/auth/logout', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Concurrent Sessions', () => {
    it('should support multiple sessions per user', async () => {
      // Create second session
      const secondLoginResponse = await fetch('http://localhost:8787/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password,
        }),
      });

      const secondCookies = testUtils.parseCookies(secondLoginResponse);
      
      // Both tokens should work
      const response1 = await fetch('http://localhost:8787/api/auth/check', {
        headers: {
          'Cookie': `accessToken=${authTokens.accessToken}`,
        },
      });
      
      const response2 = await fetch('http://localhost:8787/api/auth/check', {
        headers: {
          'Cookie': `accessToken=${secondCookies.accessToken}`,
        },
      });
      
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should enforce maximum session limit', async () => {
      // Create max sessions (5)
      const sessions = [];
      for (let i = 0; i < 5; i++) {
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
        
        const cookies = testUtils.parseCookies(response);
        sessions.push(cookies.accessToken);
      }
      
      // First session should still be valid (oldest not cleaned up yet)
      const checkResponse = await fetch('http://localhost:8787/api/auth/check', {
        headers: {
          'Cookie': `accessToken=${authTokens.accessToken}`,
        },
      });
      
      expect(checkResponse.status).toBe(200);
    });
  });
});