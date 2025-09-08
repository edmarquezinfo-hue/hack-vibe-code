# Admin Panel Specifications - KV Configuration Management

## Overview

The admin panel will directly modify the Cloudflare KV store (`VibecoderStore`) to configure runtime settings. Only rate limiting settings are configurable at runtime.

## KV Store Structure

### Namespace: `VibecoderStore`
KV Namespace ID: `f066f3c2e4824981b48e8586c04db9c1`

## Configurable Settings

### 1. Global Platform Configuration
**KV Key**: `platform_configs`

**Structure**:
```json
{
  "security": {
    "rateLimit": {
      "apiRateLimit": {
        "enabled": true,
        "store": "rate_limiter",
        "bindingName": "API_RATE_LIMITER"
      },
      "authRateLimit": {
        "enabled": true,
        "store": "rate_limiter", 
        "bindingName": "AUTH_RATE_LIMITER"
      },
      "appCreation": {
        "enabled": true,
        "store": "kv",
        "limit": 10,
        "period": 3600
      },
      "llmCalls": {
        "enabled": true,
        "store": "kv",
        "limit": 100,
        "period": 3600,
        "excludeBYOKUsers": true
      }
    }
  }
}
```

### 2. Per-User Configuration Overrides
**KV Key Pattern**: `user_config:${userId}`

**Structure** (same as global, overrides only specified values):
```json
{
  "security": {
    "rateLimit": {
      "appCreation": {
        "limit": 50,
        "period": 3600
      },
      "llmCalls": {
        "limit": 500
      }
    }
  }
}
```

## Configuration Schema

### Rate Limit Types
```typescript
enum RateLimitType {
  API_RATE_LIMIT = 'apiRateLimit',
  AUTH_RATE_LIMIT = 'authRateLimit', 
  APP_CREATION = 'appCreation',
  LLM_CALLS = 'llmCalls'
}
```

### Rate Limit Stores
```typescript
enum RateLimitStore {
  KV = 'kv',
  RATE_LIMITER = 'rate_limiter'
}
```

### KV-Based Rate Limit Config
```typescript
interface KVRateLimitConfig {
  enabled: boolean;
  store: 'kv';
  limit: number;        // requests allowed
  period: number;       // time window in seconds
  burst?: number;       // optional burst limit
  burstWindow?: number; // burst window in seconds (default: 60)
  bucketSize?: number;  // time bucket size in seconds (default: 10)
}
```

### Rate Limiter Binding Config
```typescript
interface RLRateLimitConfig {
  enabled: boolean;
  store: 'rate_limiter';
  bindingName: string; // 'API_RATE_LIMITER' or 'AUTH_RATE_LIMITER'
}
```

### LLM Calls Config (extends KV config)
```typescript
interface LLMCallsRateLimitConfig extends KVRateLimitConfig {
  excludeBYOKUsers: boolean; // exclude users with their own API keys
}
```

## Default Values

```typescript
const DEFAULT_RATE_LIMIT_SETTINGS = {
  apiRateLimit: {
    enabled: true,
    store: 'rate_limiter',
    bindingName: 'API_RATE_LIMITER'
  },
  authRateLimit: {
    enabled: true,
    store: 'rate_limiter', 
    bindingName: 'AUTH_RATE_LIMITER'
  },
  appCreation: {
    enabled: true,
    store: 'kv',
    limit: 10,
    period: 3600 // 1 hour
  },
  llmCalls: {
    enabled: true,
    store: 'kv',
    limit: 100,
    period: 3600, // 1 hour
    excludeBYOKUsers: true
  }
};
```

## Configuration Inheritance

1. **Global defaults** are hardcoded in the application
2. **Global overrides** from `platform_configs` key override defaults
3. **User-specific overrides** from `user_config:${userId}` override global settings
4. Missing values in overrides fall back to parent level
5. `undefined` values mean "use default", `null`/empty values are intentional overrides

## Admin Panel Requirements

### Core Functionality
1. **Global Configuration Management**
   - Read/write `platform_configs` KV key
   - Form interface for rate limit settings
   - Enable/disable toggles for each rate limit type

2. **User Override Management**  
   - List all users with overrides
   - Create/update/delete `user_config:${userId}` keys
   - Clear specific user overrides

3. **Rate Limit Monitoring**
   - View current rate limit buckets (read-only)
   - Pattern: `ratelimit:platform:${type}:${identifier}:${timestamp}`

### KV Operations Required
- `GET platform_configs`
- `PUT platform_configs` 
- `GET user_config:${userId}`
- `PUT user_config:${userId}`
- `DELETE user_config:${userId}`
- `LIST` with prefix `user_config:` (to find all user overrides)
- `LIST` with prefix `ratelimit:` (for monitoring, read-only)

## Non-Configurable Settings

These are hardcoded and cannot be changed via admin panel:
- Environment variables (API keys, domains, database IDs)
- Wrangler configuration (bindings, containers, routes)
- Security headers and CORS settings
- OAuth provider configurations  
- Database schema and connection settings
- AI Gateway and model configurations