import { SecurityError } from '../../types/security';
import { RateLimitType, RateLimitConfig, RateLimitStore, RateLimitSettings } from './config';
import { createObjectLogger } from '../../logger';
import { AuthUser } from '../../types/auth-types';
import { extractTokenWithMetadata, extractRequestMetadata } from '../../utils/authUtils';
import { RateLimitExceededError } from './errors';

export class RateLimitService {
    static logger = createObjectLogger(this, 'RateLimitService');

    static buildRateLimitKey(
		rateLimitType: RateLimitType,
		identifier: string
	): string {
		return `platform:${rateLimitType}:${identifier}`;
	}

	static async getUserIdentifier(user: AuthUser): Promise<string> {
		return `user:${user.id}`;
	}

    static async getRequestIdentifier(request: Request ): Promise<string> {
        const tokenResult = extractTokenWithMetadata(request);
        if (tokenResult.token) {
            const encoder = new TextEncoder();
            const data = encoder.encode(tokenResult.token);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return `token:${hashHex.slice(0, 16)}`;
        }
    
        const metadata = extractRequestMetadata(request);
        return `ip:${metadata.ipAddress}`;
    }

    static async getUniversalIdentifier(user: AuthUser | null, request: Request): Promise<string> {
        if (user) {
            return this.getUserIdentifier(user);
        }
        return this.getRequestIdentifier(request);
    }

    static async enforce(
        env: Env,
        key: string,
        config: RateLimitConfig
    ) : Promise<boolean> {
        if (config.store === RateLimitStore.RATE_LIMITER) {
            const { success } = await ( env[config.bindingName as keyof Env] as RateLimit).limit({ key });
            return success;
        } else if (config.store === RateLimitStore.KV) {
            // TODO: implement KV rate limit
            return true;
        }
        return false;
    }

    static async enforceGlobalApiRateLimit(
        env: Env,
        config: RateLimitSettings,
        user: AuthUser | null,
        request: Request
    ): Promise<void> {
        if (!config.apiRateLimit.enabled) {
            return;
        }
        const identifier = await this.getUniversalIdentifier(user, request);

        const key = this.buildRateLimitKey(RateLimitType.API_RATE_LIMIT, identifier);
        
        try {
            const success = await this.enforce(env, key, config.apiRateLimit);
            if (!success) {
                this.logger.warn('Global API rate limit exceeded', {
                    identifier,
                    key,
                    userAgent: request.headers.get('User-Agent'),
                    ip: request.headers.get('CF-Connecting-IP')
                });
                throw new RateLimitExceededError(`Global API rate limit exceeded`, RateLimitType.API_RATE_LIMIT);
            }
        } catch (error) {
            if (error instanceof RateLimitExceededError || error instanceof SecurityError) {
                throw error;
            }
            this.logger.error('Failed to enforce global API rate limit', error);
        }
    }

    static async enforceAuthRateLimit(
        env: Env,
        config: RateLimitSettings,
        user: AuthUser | null,
        request: Request
    ) {
        
        if (!config.authRateLimit.enabled) {
            return;
        }
        const identifier = await this.getUniversalIdentifier(user, request);

        const key = this.buildRateLimitKey(RateLimitType.AUTH_RATE_LIMIT, identifier);
        
        try {
            const success = await this.enforce(env, key, config.authRateLimit);
            if (!success) {
                this.logger.warn('Auth rate limit exceeded', {
                    identifier,
                    key,
                    userAgent: request.headers.get('User-Agent'),
                    ip: request.headers.get('CF-Connecting-IP')
                });
                throw new RateLimitExceededError(`Auth rate limit exceeded`, RateLimitType.AUTH_RATE_LIMIT);
            }
        } catch (error) {
            if (error instanceof RateLimitExceededError || error instanceof SecurityError) {
                throw error;
            }
            this.logger.error('Failed to enforce auth rate limit', error);
        }
    }

	static async enforceAppCreationRateLimit(
		env: Env,
		config: RateLimitSettings,
		user: AuthUser,
		request: Request
	): Promise<void> {
		if (!config.appCreation.enabled) {
			return;
		}
		const identifier = await this.getUserIdentifier(user);

		const key = this.buildRateLimitKey(RateLimitType.APP_CREATION, identifier);
		
		try {
            const success = await this.enforce(env, key, config.appCreation);
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

	static async enforceWebSocketUpgradeRateLimit(
		env: Env,
		config: RateLimitSettings,
		user: AuthUser,
		request: Request
	): Promise<void> {
		if (!config.websocketUpgrade.enabled) {
			return;
		}

		const identifier = await this.getUserIdentifier(user);
		const key = this.buildRateLimitKey(RateLimitType.WEBSOCKET_UPGRADE, identifier);
		
		try {
			const success = await this.enforce(env, key, config.websocketUpgrade);
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

	static async enforceLLMCallsRateLimit(
        env: Env,
		config: RateLimitSettings,
		user: AuthUser,
	): Promise<void> {
		
		if (!config.llmCalls.enabled) {
			return;
		}

		const identifier = await this.getUserIdentifier(user);
		
		const key = this.buildRateLimitKey(RateLimitType.LLM_CALLS, identifier);
		
		try {
			const success = await this.enforce(env, key, config.llmCalls);
			if (!success) {
				this.logger.warn('LLM calls rate limit exceeded', {
					identifier,
					key,
				});
				throw new RateLimitExceededError(
					`AI inference rate limit exceeded. Maximum ${config.llmCalls.limit} calls per ${config.llmCalls.period / 3600} hour${config.llmCalls.period >= 7200 ? 's' : ''}. Consider using your own API keys to remove this limit.`,
					RateLimitType.LLM_CALLS,
					config.llmCalls.limit,
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
}