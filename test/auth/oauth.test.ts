/**
 * OAuth Flow Tests
 * Test OAuth authentication functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { testUtils } from '../setup';

describe('OAuth Flow', () => {
  let env: Env;
  let ctx: ExecutionContext;

  beforeEach(() => {
    // Setup test environment
    env = getMiniflareBindings();
    ctx = new ExecutionContext();
  });

  describe('OAuth Initiation', () => {
    it('should redirect to Google OAuth', async () => {
      const response = await fetch('http://localhost:8787/api/auth/oauth/google', {
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toBeTruthy();
      expect(location).toContain('accounts.google.com');
      expect(location).toContain('client_id=');
      expect(location).toContain('state=');
      expect(location).toContain('code_challenge='); // PKCE
    });

    it('should redirect to GitHub OAuth', async () => {
      const response = await fetch('http://localhost:8787/api/auth/oauth/github', {
        redirect: 'manual',
      });

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toBeTruthy();
      expect(location).toContain('github.com/login/oauth');
      expect(location).toContain('client_id=');
      expect(location).toContain('state=');
    });

    it('should reject invalid OAuth provider', async () => {
      const response = await fetch('http://localhost:8787/api/auth/oauth/invalid');

      expect(response.status).toBe(400);
      
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('OAuth Callback', () => {
    it('should handle OAuth error callback', async () => {
      const response = await fetch(
        'http://localhost:8787/api/auth/callback/google?error=access_denied',
        {
          redirect: 'manual',
        }
      );

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toBe('/?error=oauth_failed');
    });

    it('should reject callback with missing code', async () => {
      const response = await fetch(
        'http://localhost:8787/api/auth/callback/google?state=test-state',
        {
          redirect: 'manual',
        }
      );

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toContain('error=missing_params');
    });

    it('should reject callback with missing state', async () => {
      const response = await fetch(
        'http://localhost:8787/api/auth/callback/google?code=test-code',
        {
          redirect: 'manual',
        }
      );

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toContain('error=missing_params');
    });

    it('should reject callback with invalid state', async () => {
      const response = await fetch(
        'http://localhost:8787/api/auth/callback/google?code=test-code&state=invalid-state',
        {
          redirect: 'manual',
        }
      );

      expect(response.status).toBe(302);
      
      const location = response.headers.get('Location');
      expect(location).toContain('error=auth_failed');
    });
  });

  describe('OAuth State Security', () => {
    it('should generate unique state for each request', async () => {
      const response1 = await fetch('http://localhost:8787/api/auth/oauth/google', {
        redirect: 'manual',
      });
      const location1 = response1.headers.get('Location');
      const state1 = new URL(location1!).searchParams.get('state');

      const response2 = await fetch('http://localhost:8787/api/auth/oauth/google', {
        redirect: 'manual',
      });
      const location2 = response2.headers.get('Location');
      const state2 = new URL(location2!).searchParams.get('state');

      expect(state1).toBeTruthy();
      expect(state2).toBeTruthy();
      expect(state1).not.toBe(state2);
    });

    it('should include PKCE parameters for supported providers', async () => {
      const response = await fetch('http://localhost:8787/api/auth/oauth/google', {
        redirect: 'manual',
      });
      
      const location = response.headers.get('Location');
      const url = new URL(location!);
      
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });
});