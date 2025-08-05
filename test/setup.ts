/**
 * Test setup file
 * Configure test environment
 */

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.BASE_URL = 'http://localhost:8787';
process.env.ENVIRONMENT = 'test';
process.env.DISABLE_RATE_LIMITING = 'true';

// Global test utilities
export const testUtils = {
  // Generate test user data
  generateTestUser() {
    const id = crypto.randomUUID();
    return {
      id,
      email: `test-${id}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
    };
  },

  // Generate test JWT
  async generateTestJWT(payload: any) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const signature = await crypto.subtle.digest('SHA-256', data);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
    return `test.${btoa(JSON.stringify(payload))}.${base64Signature}`;
  },

  // Parse cookies from response
  parseCookies(response: Response): Record<string, string> {
    const cookies: Record<string, string> = {};
    const setCookieHeader = response.headers.get('Set-Cookie');
    
    if (setCookieHeader) {
      const cookieStrings = setCookieHeader.split(', ');
      cookieStrings.forEach((header: string) => {
        const [cookie] = header.split(';');
        const [name, value] = cookie.split('=');
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
      });
    }
    
    return cookies;
  },
};