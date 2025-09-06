export enum RateLimitStore {
    KV = 'kv',
    RATE_LIMITER = 'rate_limiter'
}

export interface RateLimitConfigBase {
	enabled: boolean;
    store: RateLimitStore;
}

export interface KVRateLimitConfig extends RateLimitConfigBase {
    store: RateLimitStore.KV;
    limit: number;
    period: number; // in seconds
    burst?: number; // optional burst limit
}

export interface RLRateLimitConfig extends RateLimitConfigBase {
    store: RateLimitStore.RATE_LIMITER;
    bindingName: string;
    // Rate limits via bindings are configurable only via wrangler configs
}

export type RateLimitConfig = RLRateLimitConfig | KVRateLimitConfig;

export interface LLMCallsRateLimitConfig extends KVRateLimitConfig {
    excludeBYOKUsers: boolean;
}

export interface RateLimitSettings {
    apiRateLimit: RLRateLimitConfig;
    authRateLimit: RLRateLimitConfig;
    appCreation: KVRateLimitConfig;
	llmCalls: LLMCallsRateLimitConfig;
	websocketUpgrade: KVRateLimitConfig;
}

export const DEFAULT_RATE_LIMIT_SETTINGS: RateLimitSettings = {
    apiRateLimit: {
        enabled: true,
        store: RateLimitStore.RATE_LIMITER,
        bindingName: 'API_RATE_LIMITER'
    },
    authRateLimit: {
        enabled: true,
        store: RateLimitStore.RATE_LIMITER,
        bindingName: 'AUTH_RATE_LIMITER'
    },
	appCreation: {
		enabled: true,
        store: RateLimitStore.KV,
		limit: 10,
		period: 3600, // 1 hour
	},
	llmCalls: {
		enabled: true,
        store: RateLimitStore.KV,
		limit: 100,
		period: 3600, // 1 hour  
		excludeBYOKUsers: true
	},
	websocketUpgrade: {
		enabled: true,
        store: RateLimitStore.KV,
		limit: 50,
		period: 3600 // 1 hour
	}
};

export enum RateLimitType {
    API_RATE_LIMIT = 'api_rate_limit',
    AUTH_RATE_LIMIT = 'auth_rate_limit',
	APP_CREATION = 'app_creation',
	LLM_CALLS = 'llm_calls',
	WEBSOCKET_UPGRADE = 'websocket_upgrade'
}