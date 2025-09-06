# Security Configuration Guide

## Overview
This document outlines the security measures implemented in the Cloudflare Orange Build platform.

## Security Features

### 1. CORS (Cross-Origin Resource Sharing)
- **Configuration**: `worker/middleware/security/cors.ts`
- **Allowed Origins**:
  - Production: `https://build.cloudflare.dev`, `https://*.build.cloudflare.dev`
  - Cloudflare Pages: `https://orange-build.pages.dev`, `https://*.orange-build.pages.dev`
  - Custom Domain: Configured via `CUSTOM_DOMAIN` environment variable
  - Development: `localhost:3000`, `localhost:5173` (only in dev mode)
- **Credentials**: Enabled for authenticated requests
- **Preflight Cache**: 24 hours

### 2. Security Headers
- **Configuration**: `worker/middleware/security/headers.ts`
- **Headers Applied**:
  - `Strict-Transport-Security`: HSTS with 1-year max-age (production only)
  - `X-Content-Type-Options`: nosniff
  - `X-Frame-Options`: DENY
  - `X-XSS-Protection`: 1; mode=block
  - `Content-Security-Policy`: Restrictive CSP with nonce-based scripts
  - `Referrer-Policy`: strict-origin-when-cross-origin
  - `Permissions-Policy`: Restrictive permissions
  - `Cross-Origin-*`: CORS isolation headers

### 3. Rate Limiting
- **Configuration**: `worker/middleware/security/rateLimiter.ts`
- **Limits**:
  - API Endpoints: 100 requests/minute (production), 1000 requests/minute (development)
  - Authentication: 5 attempts/minute (production), 20 attempts/minute (development)
  - WebSocket Connections: 10 connections/minute (production), 100 connections/minute (development)
- **Bypass**: BYOK users with custom API keys are exempt from rate limiting

### 4. CSRF Protection
- **Configuration**: `worker/middleware/security/csrf.ts`
- **Token Storage**: KV namespace with 24-hour TTL
- **Token Delivery**: Via secure HTTP-only cookie
- **Validation**: Required for all state-changing operations (POST, PUT, DELETE, PATCH)
- **Excluded Methods**: GET, HEAD, OPTIONS

### 5. WebSocket Security
- **Configuration**: `worker/middleware/security/websocket.ts`
- **Origin Validation**: Strict origin checking against allowed CORS origins
- **Rate Limiting**: Connection rate limiting per user/IP
- **Authentication**: Optional user context for authenticated connections

### 6. Input Validation
- **Configuration**: `worker/middleware/security/inputValidator.ts`
- **Validation Library**: Zod schemas
- **Features**:
  - Request body size limit (1MB)
  - Content-type validation
  - Schema-based validation with detailed error messages
  - SQL injection prevention through parameterized queries
  - XSS prevention through output encoding

### 7. Authentication Security
- **Password Hashing**: PBKDF2 with 100,000 iterations
- **JWT Tokens**: Signed with HS256, stored as hashes in database
- **Session Management**: Secure, HTTP-only cookies with SameSite=Strict
- **OAuth**: GitHub and Google OAuth2 integration
- **Token Rotation**: Refresh token rotation on use

### 8. Security Monitoring
- **Configuration**: `worker/middleware/security/monitor.ts`
- **Events Tracked**:
  - Unauthorized access attempts
  - Rate limit violations
  - CSRF violations
  - Authentication failures
  - Invalid input attempts
- **Brute Force Detection**: Automatic detection of repeated auth failures
- **Event Storage**: 7-day retention in KV namespace

## Environment Variables

```bash
# Security Configuration
CUSTOM_DOMAIN=your-domain.com        # Your custom domain for CORS
ENVIRONMENT=production               # Options: development, staging, production

# Authentication
JWT_SECRET=<strong-random-secret>    # JWT signing secret
WEBHOOK_SECRET=<strong-random-secret> # Webhook validation secret

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
GITHUB_CLIENT_ID=<client-id>
GITHUB_CLIENT_SECRET=<client-secret>
```

## Security Best Practices

### Development
1. Use `ENVIRONMENT=development` for relaxed security during development
2. Test with production security settings before deployment
3. Regularly update dependencies for security patches

### Production
1. Set `ENVIRONMENT=production` to enable all security features
2. Configure `CUSTOM_DOMAIN` for proper CORS validation
3. Use strong, unique secrets for JWT and webhooks
4. Monitor security events regularly
5. Keep rate limits appropriate for your traffic

### API Usage
1. Include CSRF token in headers for state-changing requests
2. Handle rate limit responses (429) with exponential backoff
3. Use proper authentication headers (Bearer tokens)
4. Validate SSL certificates in production

## Security Headers Example

```http
HTTP/2 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-xxx'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

## Incident Response

### Rate Limit Exceeded
- Check `X-RateLimit-*` headers for limit details
- Implement exponential backoff
- Consider upgrading to BYOK for unlimited access

### CORS Errors
- Verify origin is in allowed list
- Check preflight request handling
- Ensure credentials are properly configured

### Authentication Failures
- Check for brute force attempts in security logs
- Verify JWT token expiration
- Ensure OAuth provider configuration

## Compliance

This security implementation follows:
- OWASP Top 10 security guidelines
- Cloudflare Workers security best practices
- Industry-standard authentication patterns
- GDPR-compliant data handling (EU users)

## Support

For security concerns or questions:
1. Check security event logs in KV namespace
2. Review rate limit metrics
3. Monitor authentication patterns
4. Contact security team for critical issues
