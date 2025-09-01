export interface RateLimitError {
	type: 'RATE_LIMIT_EXCEEDED';
	message: string;
	limitType: 'app_creation' | 'llm_calls' | 'websocket_upgrade';
	retryAfter?: number; // seconds
	limit: number;
	period: number; // seconds
	suggestions?: string[];
}

export interface RateLimitErrorResponse {
	error: string;
	type: 'RATE_LIMIT_EXCEEDED';
	details: RateLimitError;
}

export function createRateLimitErrorResponse(
	limitType: RateLimitError['limitType'],
	message: string,
	limit: number,
	period: number,
	retryAfter?: number
): RateLimitErrorResponse {
	const suggestions: string[] = [];
	
	if (limitType === 'llm_calls') {
		suggestions.push('Consider adding your own API keys in Settings to remove this limit');
		suggestions.push('Use BYOK (Bring Your Own Keys) for unlimited access');
	}
	
	if (limitType === 'app_creation') {
		suggestions.push('Try again in an hour when the limit resets');
		suggestions.push('Consider upgrading your plan for higher limits');
	}

	return {
		error: message,
		type: 'RATE_LIMIT_EXCEEDED',
		details: {
			type: 'RATE_LIMIT_EXCEEDED',
			message,
			limitType,
			retryAfter,
			limit,
			period,
			suggestions
		}
	};
}