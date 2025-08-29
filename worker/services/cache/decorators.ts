/**
 * Cacheable decorator for controller methods
 */

import { CacheService } from './CacheService';
import type { RouteContext } from '../../api/types/route-context';

interface CacheableOptions {
	ttlSeconds: number;
	tags?: string[];
	keyGenerator?: (
		request: Request,
		context: RouteContext,
		userId?: string,
	) => string | Promise<string>;
}

/**
 * Decorator to add caching to controller methods
 */
export function Cacheable(options: CacheableOptions) {
	return function <T extends (...args: [Request, Env, ExecutionContext, RouteContext]) => Promise<Response>>(
		_target: unknown,
		_propertyKey: string,
		descriptor: TypedPropertyDescriptor<T>,
	): TypedPropertyDescriptor<T> {
		const originalMethod = descriptor.value!;
		const cacheService = new CacheService();

		descriptor.value = (async function (
			this: unknown,
			request: Request,
			env: Env,
			ctx: ExecutionContext,
			context: RouteContext,
		): Promise<Response> {
			// Generate cache key
			let userId = context?.user?.id;

			// For public endpoints, try to get optional user if not already available
			if (!userId && (this as { getOptionalUser?: Function }).getOptionalUser) {
				try {
					const user = await (this as { getOptionalUser: Function }).getOptionalUser(request, env);
					userId = user?.id;
				} catch {
					// Ignore auth errors for public endpoints
				}
			}

			const cacheKey = options.keyGenerator
				? await options.keyGenerator(request, context, userId)
				: cacheService.generateKey(request, userId);

			// Use cache wrapper
			return cacheService.withCache(
				cacheKey,
				() => originalMethod.call(this, request, env, ctx, context),
				{ ttlSeconds: options.ttlSeconds, tags: options.tags },
			);
		}) as T;

		return descriptor;
	};
}
