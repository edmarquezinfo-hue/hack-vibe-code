import { SecurityError, SecurityErrorType } from '../../types/security';
import { AuthUser } from '../../types/auth-types';
import { extractTokenWithMetadata, extractRequestMetadata } from '../../utils/authUtils';

export interface RateLimitContext {
	request: Request;
	user?: AuthUser | null;
}

async function getIdentifier(context: RateLimitContext): Promise<string> {
	// Priority 1: Authenticated user ID (most stable)
	if (context.user && !context.user.isAnonymous) {
		return `user:${context.user.id}`;
	}

	// Priority 2: Anonymous session ID
	if (context.user?.isAnonymous && context.user.id) {
		return `anon:${context.user.id}`;
	}

	// Priority 3: Token hash (for pre-auth rate limiting)
	const tokenResult = extractTokenWithMetadata(context.request);
	if (tokenResult.token) {
		const encoder = new TextEncoder();
		const data = encoder.encode(tokenResult.token);
		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
		return `token:${hashHex.slice(0, 16)}`;
	}

	// Priority 4: IP address (fallback)
	const metadata = extractRequestMetadata(context.request);
	return `ip:${metadata.ipAddress}`;
}

function buildKey(namespace: string, pathname: string, identifier: string): string {
	return `${namespace}:${pathname}:${identifier}`;
}

async function enforce(binding: RateLimit, key: string): Promise<void> {
	const { success } = await binding.limit({ key });
	if (!success) {
		throw new SecurityError(
			SecurityErrorType.RATE_LIMITED,
			'Rate limit exceeded',
			429
		);
	}
}

export async function enforceGlobalApiRateLimit(
	context: RateLimitContext,
	env: Env
): Promise<void> {
	const limiter = env.API_RATE_LIMITER;
	const url = new URL(context.request.url);
	const identifier = await getIdentifier(context);
	const key = buildKey('api', url.pathname, identifier);
	await enforce(limiter, key);
}

export async function enforceAuthRateLimit(
	context: RateLimitContext,
	env: Env
): Promise<void> {
	const limiter = env.AUTH_RATE_LIMITER;
	const url = new URL(context.request.url);
	const identifier = await getIdentifier(context);
	const key = buildKey('auth', url.pathname, identifier);
	await enforce(limiter, key);
}
