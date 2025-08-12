import { Context, Next } from "hono";
import type { AppContext } from "../types";

/**
 * JWT Token payload structure for templates gateway
 */
interface TokenPayload {
  sub: string; // sessionId
  email: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
  jti?: string; // instanceId
  sessionId?: string;
}

/**
 * Authentication middleware for templates-gateway
 * Validates JWT bearer tokens and verifies against KV registry
 */
export async function authMiddleware(c: AppContext, next: Next) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = c.req.header("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ 
        error: "Missing or invalid Authorization header. Expected: Bearer <token>" 
      }, 401);
    }

    const jwtToken = authHeader.substring(7); // Remove "Bearer " prefix
    
    if (!jwtToken) {
      return c.json({ 
        error: "Bearer token is empty" 
      }, 401);
    }

    // Verify JWT token
    const payload = await verifyJWT(jwtToken, c.env.AI_GATEWAY_PROXY_FOR_TEMPLATES_JWT_SECRET);
    if (!payload) {
      return c.json({ 
        error: "Invalid or expired JWT token" 
      }, 401);
    }

    // Check KV registry for valid JWT token
    const kvKey = `agent-orangebuild-${jwtToken}`;
    const registeredInstanceId = await c.env.INSTANCE_REGISTRY?.get(kvKey);

    if (!registeredInstanceId) {
      return c.json({ 
        error: "JWT token not found in registry or expired" 
      }, 401);
    }

    // Validate that the instanceId in JWT matches the one in KV
    if (payload.jti && payload.jti !== registeredInstanceId) {
      return c.json({ 
        error: "JWT token instanceId mismatch" 
      }, 401);
    }

    // Store context information for endpoints
    c.set('instanceId', registeredInstanceId);
    c.set('sessionId', payload.sub);
    c.set('jwtPayload', payload);

    // Authentication successful, proceed to next handler
    await next();
    
  } catch (error) {
    console.error("Auth middleware error:", error);
    return c.json({ 
      error: "Authentication failed" 
    }, 500);
  }
}

/**
 * Verify JWT token using Web Crypto API (same algorithm as TokenService)
 * @param token JWT token to verify
 * @param secret JWT secret for verification
 * @returns Decoded payload or null if invalid
 */
async function verifyJWT(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    
    // Verify signature using the same method as TokenService
    const message = `${encodedHeader}.${encodedPayload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode signature from base64url
    const signature = base64UrlToArrayBuffer(encodedSignature);
    const isValid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(message));
    
    if (!isValid) {
      console.warn('JWT signature verification failed');
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as TokenPayload;
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('JWT token expired');
      return null;
    }

    // Basic payload validation
    if (!payload.sub || !payload.type || !payload.exp || !payload.iat) {
      console.warn('Invalid JWT payload structure');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Error verifying JWT token:', error);
    return null;
  }
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(data: string): string {
  // Add padding if needed
  const padded = data + '='.repeat((4 - data.length % 4) % 4);
  // Replace URL-safe characters
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

/**
 * Convert base64url string to ArrayBuffer
 */
function base64UrlToArrayBuffer(data: string): ArrayBuffer {
  const binary = base64UrlDecode(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Optional middleware that logs authentication attempts
 */
export async function authLoggingMiddleware(c: AppContext, next: Next) {
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const path = new URL(c.req.url).pathname;
  
  console.log(`Auth attempt: Bearer=${bearerToken ? `${bearerToken.substring(0, 8)}...` : 'none'}, Path=${path}`);
  
  await next();
}