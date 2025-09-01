import { SecurityError } from '../../types/security';
import { PlatformRateLimitSettings, RateLimitType, DEFAULT_RATE_LIMIT_SETTINGS } from '../../types/rate-limit-config';
import { createObjectLogger, StructuredLogger } from '../../logger';
import { AuthUser } from '../../types/auth-types';
import { SecretsService } from '../../database/services/SecretsService';

export class RateLimitExceededError extends Error {
	constructor(
		message: string,
		public limitType: RateLimitType,
		public limit: number,
		public period: number,
		public retryAfter: number = 3600
	) {
		super(message);
		this.name = 'RateLimitExceededError';
	}
}

const RATE_LIMIT_CONFIG_KEY = 'platform_rate_limits';

export class PlatformRateLimitService {
	private logger: StructuredLogger;

	constructor(
		private env: Env,
		private secretsService?: SecretsService
	) {
		this.logger = createObjectLogger(this, 'PlatformRateLimitService');
	}

	private async loadConfig(): Promise<PlatformRateLimitSettings> {
		try {
			const configJson = await this.env.VibecoderStore.get(RATE_LIMIT_CONFIG_KEY);
			if (configJson) {
				return JSON.parse(configJson);
			}
			return DEFAULT_RATE_LIMIT_SETTINGS;
		} catch (error) {
			this.logger.error('Failed to load rate limit configuration, using defaults', error);
			return DEFAULT_RATE_LIMIT_SETTINGS;
		}
	}

	private async isUserExcludedFromRateLimit(
		user: AuthUser | null, 
		rateLimitType: RateLimitType
	): Promise<boolean> {
		if (!user || user.isAnonymous) {
			return false;
		}

		const config = await this.loadConfig();

		if (rateLimitType === RateLimitType.LLM_CALLS && config.llmCalls.excludeBYOKUsers) {
			try {
				if (!this.secretsService) {
					return false;
				}
				const userBYOKKeys = await this.secretsService.getUserBYOKKeysMap(user.id);
				const hasBYOKKeys = userBYOKKeys && userBYOKKeys.size > 0;
				
				if (hasBYOKKeys) {
					this.logger.info(`User ${user.id} excluded from LLM rate limiting due to BYOK keys`);
					return true;
				}
			} catch (error) {
				this.logger.error('Failed to check BYOK keys for rate limit exclusion', error);
			}
		}

		return false;
	}

	private buildRateLimitKey(
		rateLimitType: RateLimitType,
		identifier: string
	): string {
		return `platform:${rateLimitType}:${identifier}`;
	}

	private async getUserIdentifier(user: AuthUser | null): Promise<string> {
		if (user && !user.isAnonymous) {
			return `user:${user.id}`;
		}
		if (user?.isAnonymous && user.id) {
			return `anon:${user.id}`;
		}
		return 'global';
	}

	async enforceAppCreationRateLimit(
		user: AuthUser | null,
		request: Request
	): Promise<void> {
		const config = await this.loadConfig();
		
		if (!config.appCreation.enabled) {
			return;
		}

		if (await this.isUserExcludedFromRateLimit(user, RateLimitType.APP_CREATION)) {
			return;
		}

		const identifier = config.appCreation.perUser 
			? await this.getUserIdentifier(user)
			: 'global';
		
		const key = this.buildRateLimitKey(RateLimitType.APP_CREATION, identifier);
		
		try {
			const { success } = await this.env.APP_CREATION_RATE_LIMITER.limit({ key });
			if (!success) {
				this.logger.warn('App creation rate limit exceeded', {
					identifier,
					key,
					userAgent: request.headers.get('User-Agent'),
					ip: request.headers.get('CF-Connecting-IP')
				});
				throw new RateLimitExceededError(
					`App creation rate limit exceeded. Maximum ${config.appCreation.limit} apps per ${config.appCreation.period / 3600} hour${config.appCreation.period >= 7200 ? 's' : ''}`,
					RateLimitType.APP_CREATION,
					config.appCreation.limit,
					config.appCreation.period,
					config.appCreation.period
				);
			}
		} catch (error) {
			if (error instanceof RateLimitExceededError || error instanceof SecurityError) {
				throw error;
			}
			this.logger.error('Failed to enforce app creation rate limit', error);
		}
	}

	async enforceWebSocketUpgradeRateLimit(
		user: AuthUser | null,
		request: Request
	): Promise<void> {
		const config = await this.loadConfig();
		
		if (!config.websocketUpgrade.enabled) {
			return;
		}

		const identifier = await this.getUserIdentifier(user);
		const key = this.buildRateLimitKey(RateLimitType.WEBSOCKET_UPGRADE, identifier);
		
		try {
			const { success } = await this.env.WEBSOCKET_RATE_LIMITER.limit({ key });
			if (!success) {
				this.logger.warn('WebSocket upgrade rate limit exceeded', {
					identifier,
					key,
					userAgent: request.headers.get('User-Agent'),
					ip: request.headers.get('CF-Connecting-IP')
				});
				throw new RateLimitExceededError(
					`WebSocket connection rate limit exceeded. Maximum ${config.websocketUpgrade.limit} connections per ${config.websocketUpgrade.period / 3600} hour${config.websocketUpgrade.period >= 7200 ? 's' : ''}`,
					RateLimitType.WEBSOCKET_UPGRADE,
					config.websocketUpgrade.limit,
					config.websocketUpgrade.period,
					config.websocketUpgrade.period
				);
			}
		} catch (error) {
			if (error instanceof RateLimitExceededError || error instanceof SecurityError) {
				throw error;
			}
			this.logger.error('Failed to enforce WebSocket upgrade rate limit', error);
		}
	}

	async enforceLLMCallsRateLimit(
		user: AuthUser | null,
		request?: Request
	): Promise<void> {
		const config = await this.loadConfig();
		
		if (!config.llmCalls.enabled) {
			return;
		}

		if (await this.isUserExcludedFromRateLimit(user, RateLimitType.LLM_CALLS)) {
			return;
		}

		const identifier = config.llmCalls.perUser 
			? await this.getUserIdentifier(user)
			: 'global';
		
		const key = this.buildRateLimitKey(RateLimitType.LLM_CALLS, identifier);
		
		try {
			const { success } = await this.env.LLM_CALLS_RATE_LIMITER.limit({ key });
			if (!success) {
				this.logger.warn('LLM calls rate limit exceeded', {
					identifier,
					key,
					userAgent: request?.headers.get('User-Agent'),
					ip: request?.headers.get('CF-Connecting-IP')
				});
				throw new RateLimitExceededError(
					`AI inference rate limit exceeded. Maximum ${config.llmCalls.limit} calls per ${config.llmCalls.period / 3600} hour${config.llmCalls.period >= 7200 ? 's' : ''}. Consider using your own API keys to remove this limit.`,
					RateLimitType.LLM_CALLS,
					config.llmCalls.limit,
					config.llmCalls.period,
					config.llmCalls.period
				);
			}
		} catch (error) {
			if (error instanceof RateLimitExceededError || error instanceof SecurityError) {
				throw error;
			}
			this.logger.error('Failed to enforce LLM calls rate limit', error);
		}
	}

	async updateConfiguration(newConfig: Partial<PlatformRateLimitSettings>): Promise<void> {
		const currentConfig = await this.loadConfig();
		const mergedConfig = { ...currentConfig, ...newConfig };
		
		await this.env.VibecoderStore.put(
			RATE_LIMIT_CONFIG_KEY, 
			JSON.stringify(mergedConfig)
		);
		
		this.logger.info('Updated rate limit configuration', { newConfig: mergedConfig });
	}

	async getConfiguration(): Promise<PlatformRateLimitSettings> {
		return await this.loadConfig();
	}
}