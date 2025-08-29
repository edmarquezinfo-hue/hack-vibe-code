/**
 * Simple Cache Service using Cloudflare Cache API
 */

export interface CacheOptions {
	ttlSeconds: number;
	tags?: string[];
}

export class CacheService {
	/**
	 * Get cached response
	 */
	async get(key: string): Promise<Response | undefined> {
		const cache = await caches.open('v1');
		// Use a proper URL for cache keys
		const cacheUrl = `https://cache.internal/${encodeURIComponent(key)}`;
		const cacheKey = new Request(cacheUrl);
		return await cache.match(cacheKey);
	}

	/**
	 * Store response in cache
	 */
	async put(
		key: string,
		response: Response,
		options: CacheOptions,
	): Promise<void> {
		// Use a proper URL for cache keys
		const cacheUrl = `https://cache.internal/${encodeURIComponent(key)}`;
		const cacheKey = new Request(cacheUrl);

		// Convert Headers to a plain object
		const headersObj: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			headersObj[key] = value;
		});

		const responseToCache = new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: {
				...headersObj,
				'Cache-Control': `public, max-age=${options.ttlSeconds}`,
				...(options.tags
					? { 'Cache-Tag': options.tags.join(',') }
					: {}),
			},
		});

		const cache = await caches.open('v1');
		await cache.put(cacheKey, responseToCache);
	}

	/**
	 * Generate cache key from request
	 */
	generateKey(request: Request, userId?: string): string {
		const url = new URL(request.url);
		const baseKey = `${url.pathname}${url.search}`;
		return userId ? `${baseKey}:user:${userId}` : baseKey;
	}

	/**
	 * Simple wrapper for caching controller responses
	 */
	async withCache(
		cacheKey: string,
		operation: () => Promise<Response>,
		options: CacheOptions,
	): Promise<Response> {
		// Try to get from cache first
		const cached = await this.get(cacheKey);
		if (cached) {
			return cached;
		}

		// Execute operation and cache result
		const response = await operation();
		if (response.ok) {
			await this.put(cacheKey, response.clone(), options);
		}

		return response;
	}
}
