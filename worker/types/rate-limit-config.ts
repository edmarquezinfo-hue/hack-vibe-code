export interface RateLimitConfig {
	enabled: boolean;
	limit: number;
	period: number; // in seconds
	burst?: number; // optional burst limit
}

export interface AppCreationRateLimitConfig extends RateLimitConfig {
	perUser: boolean; // rate limit per user vs global
}

export interface LLMCallsRateLimitConfig extends RateLimitConfig {
	perUser: boolean;
	excludeBYOKUsers: boolean; // exclude users with BYOK keys
}

export interface PlatformRateLimitSettings {
	appCreation: AppCreationRateLimitConfig;
	llmCalls: LLMCallsRateLimitConfig;
	websocketUpgrade: RateLimitConfig;
}

export const DEFAULT_RATE_LIMIT_SETTINGS: PlatformRateLimitSettings = {
	appCreation: {
		enabled: true,
		limit: 10,
		period: 3600, // 1 hour
		perUser: true
	},
	llmCalls: {
		enabled: true,
		limit: 1000,
		period: 3600, // 1 hour  
		perUser: true,
		excludeBYOKUsers: true
	},
	websocketUpgrade: {
		enabled: true,
		limit: 50,
		period: 3600 // 1 hour
	}
};

export enum RateLimitType {
	APP_CREATION = 'app_creation',
	LLM_CALLS = 'llm_calls',
	WEBSOCKET_UPGRADE = 'websocket_upgrade'
}