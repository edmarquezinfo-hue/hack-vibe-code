import { SecurityError } from '../../types/security';
import { RateLimitType, RateLimitStore, RateLimitSettings, KVRateLimitConfig } from './config';
import { createObjectLogger } from '../../logger';
import { AuthUser } from '../../types/auth-types';
import { extractTokenWithMetadata, extractRequestMetadata } from '../../utils/authUtils';
import { RateLimitExceededError } from './errors';
import { getUserConfigurableSettings } from '../../config';

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

    static async getRequestIdentifier(request: Request): Promise<string> {
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

    /**
     * KV-based rate limiting using bucketed sliding window algorithm
     * Distributes writes across time-bucketed keys to avoid KV write limits
     */
    private static async enforceKVRateLimit(
        env: Env,
        key: string,
        config: KVRateLimitConfig
    ): Promise<boolean> {
        const kv = env.VibecoderStore;
        const now = Date.now();
        
        const bucketSize = (config.bucketSize || 10) * 1000; // Convert to milliseconds
        const burstWindow = (config.burstWindow || 60) * 1000; // Convert to milliseconds
        const mainWindow = config.period * 1000; // Convert to milliseconds
        
        const currentBucket = Math.floor(now / bucketSize) * bucketSize;
        
        try {
            // Generate bucket keys for main window
            const mainBuckets = this.generateBucketKeys(key, now, mainWindow, bucketSize);
            const burstBuckets = config.burst ? this.generateBucketKeys(key, now, burstWindow, bucketSize) : [];
            
            // Read all buckets in parallel
            const allBucketKeys = [...new Set([...mainBuckets, ...burstBuckets])];
            const bucketPromises = allBucketKeys.map(async bucketKey => {
                const value = await kv.get(bucketKey);
                return { key: bucketKey, count: value ? parseInt(value, 10) || 0 : 0 };
            });
            
            const bucketResults = await Promise.all(bucketPromises);
            const bucketMap = new Map(bucketResults.map(r => [r.key, r.count]));
            
            // Calculate current counts
            const mainCount = mainBuckets.reduce((sum, bucketKey) => sum + (bucketMap.get(bucketKey) || 0), 0);
            const burstCount = burstBuckets.reduce((sum, bucketKey) => sum + (bucketMap.get(bucketKey) || 0), 0);
            
            // Check limits
            if (mainCount >= config.limit) {
                return false;
            }
            
            if (config.burst && burstCount >= config.burst) {
                return false;
            }
            
            // Increment current bucket with retry logic
            const currentBucketKey = `ratelimit:${key}:${currentBucket}`;
            const maxTtl = Math.max(config.period, config.burstWindow || 60) + (config.bucketSize || 10);
            
            await this.incrementBucketWithRetry(kv, currentBucketKey, maxTtl);
            
            return true;
            
        } catch (error) {
            this.logger.error('Failed to enforce KV rate limit', {
                key,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            return true; // Fail open
        }
    }
    
    private static generateBucketKeys(key: string, now: number, windowMs: number, bucketSizeMs: number): string[] {
        const buckets: string[] = [];
        const windowStart = now - windowMs;
        
        for (let time = Math.floor(windowStart / bucketSizeMs) * bucketSizeMs; time <= now; time += bucketSizeMs) {
            buckets.push(`ratelimit:${key}:${time}`);
        }
        
        return buckets;
    }
    
    private static async incrementBucketWithRetry(
        kv: KVNamespace,
        bucketKey: string,
        ttl: number,
        maxRetries: number = 3
    ): Promise<void> {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const current = await kv.get(bucketKey);
                const newCount = (current ? parseInt(current, 10) : 0) + 1;
                
                await kv.put(bucketKey, newCount.toString(), { expirationTtl: ttl });
                return;
                
            } catch (error) {
                if (error instanceof Error && error.message.includes('429') && attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
                    continue;
                }
                throw error;
            }
        }
    }

    static async applyUserConfigs(
        env: Env,
        config: RateLimitSettings,
        user: AuthUser | null,
        limitType: RateLimitType
    ) : Promise<RateLimitSettings> {
        if (config[limitType].store !== RateLimitStore.RATE_LIMITER && user) {
            // Only fetch user configurable settings IF user is available and limit type is configurable
            const userConfigs = await getUserConfigurableSettings(env, user.id, {security: {rateLimit: config}});
            config = userConfigs.security.rateLimit;
        }
        return config;
    }

    static async enforce(
        env: Env,
        key: string,
        config: RateLimitSettings,
        limitType: RateLimitType
    ) : Promise<boolean> {
        config = await this.applyUserConfigs(env, config, null, limitType);
        if (config[limitType].store === RateLimitStore.RATE_LIMITER) {
            const { success } = await ( env[config[limitType].bindingName as keyof Env] as RateLimit).limit({ key });
            return success;
        } else if (config[limitType].store === RateLimitStore.KV) {
            return this.enforceKVRateLimit(env, key, config[limitType]);
        }
        return false;
    }

    static async enforceGlobalApiRateLimit(
        env: Env,
        config: RateLimitSettings,
        user: AuthUser | null,
        request: Request
    ): Promise<void> {
        if (!config[RateLimitType.API_RATE_LIMIT].enabled) {
            return;
        }
        const identifier = await this.getUniversalIdentifier(user, request);

        const key = this.buildRateLimitKey(RateLimitType.API_RATE_LIMIT, identifier);
        
        try {
            const success = await this.enforce(env, key, config, RateLimitType.API_RATE_LIMIT);
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
        
        if (!config[RateLimitType.AUTH_RATE_LIMIT].enabled) {
            return;
        }
        const identifier = await this.getUniversalIdentifier(user, request);

        const key = this.buildRateLimitKey(RateLimitType.AUTH_RATE_LIMIT, identifier);
        
        try {
            const success = await this.enforce(env, key, config, RateLimitType.AUTH_RATE_LIMIT);
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
		if (!config[RateLimitType.APP_CREATION].enabled) {
			return;
		}
		const identifier = await this.getUserIdentifier(user);

		const key = this.buildRateLimitKey(RateLimitType.APP_CREATION, identifier);
		
		try {
            const success = await this.enforce(env, key, config, RateLimitType.APP_CREATION);
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

	static async enforceLLMCallsRateLimit(
        env: Env,
		config: RateLimitSettings,
		user: AuthUser,
	): Promise<void> {
		
		if (!config[RateLimitType.LLM_CALLS].enabled) {
			return;
		}

		const identifier = await this.getUserIdentifier(user);
		
		const key = this.buildRateLimitKey(RateLimitType.LLM_CALLS, identifier);
		
		try {
			const success = await this.enforce(env, key, config, RateLimitType.LLM_CALLS);
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