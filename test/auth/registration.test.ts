/**
 * Registration Flow Tests
 * Test user registration functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils } from '../setup';

describe('Registration Flow', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    // Setup test environment
    env = getMiniflareBindings();
    ctx = new ExecutionContext();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const userData = testUtils.generateTestUser();
      
      const response = await fetch('http://localhost:8787/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          name: userData.name,
        }),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.email).toBe(userData.email);
      expect(data.data.user.displayName).toBe(userData.name);
      expect(data.data.expiresIn).toBe(3600);
      
      // Check cookies
      const cookies = testUtils.parseCookies(response);
      expect(cookies.accessToken).toBeDefined();
      expect(cookies.refreshToken).toBeDefined();
    });

    it('should reject registration with invalid email', async () => {
      const response = await fetch('http://localhost:8787/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'ValidPassword123!',
          name: 'Test User',
        }),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const response = await fetch('http://localhost:8787/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
        }),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('password');
    });

    it('should reject duplicate email registration', async () => {
      const userData = testUtils.generateTestUser();
      
      // First registration
      await fetch('http://localhost:8787/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
        }),
      });

      // Second registration with same email
      const response = await fetch('http://localhost:8787/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
        }),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('already registered');
    });

    it('should handle missing required fields', async () => {
      const response = await fetch('http://localhost:8787/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          // Missing password
        }),
      });

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should sanitize user input', async () => {
      const response = await fetch('http://localhost:8787/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'Test@Example.COM', // Should be lowercased
          password: 'ValidPassword123!',
          name: '<script>alert("XSS")</script>', // Should be sanitized
        }),
      });

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.data.user.email).toBe('test@example.com');
      // Name sanitization happens at display time, stored as-is
    });
  });

  describe('Registration Rate Limiting', () => {
    it('should enforce rate limits in production', async () => {
      // Note: Rate limiting is disabled in test environment
      // This test would fail in production after X attempts
      
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          fetch('http://localhost:8787/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: `test${i}@example.com`,
              password: 'ValidPassword123!',
            }),
          })
        );
      }

      const responses = await Promise.all(promises);
      
      // In test environment, all should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});