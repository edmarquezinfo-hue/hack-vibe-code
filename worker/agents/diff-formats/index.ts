/**
 * Diff Format Implementations for LLM-generated code changes
 * 
 * This module provides two different diff format implementations,
 * each with the same API but different approaches to handling changes.
 */

import { applyDiff as applyUnifiedDiff } from './udiff';
import { 
	applyDiff as applySearchReplaceDiff,
	createSearchReplaceDiff,
	validateDiff as validateSearchReplaceDiff,
	ApplyResult,
	FailedBlock,
	MatchingStrategy
} from './search-replace';

export {
	// Unified Diff Format (git-style)
	applyUnifiedDiff,
	
	// Search/Replace Format (simpler, more reliable for LLMs)
	applySearchReplaceDiff,
	createSearchReplaceDiff,
	validateSearchReplaceDiff,
	
	// Types and utilities
	type ApplyResult,
	type FailedBlock,
	MatchingStrategy,
};

/**
 * Result type for diff application
 */
export interface DiffResult {
	content: string;
	results: {
		blocksTotal: number;
		blocksApplied: number;
		blocksFailed: number;
		errors: string[];
		warnings: string[];
	};
}

/**
 * Detect diff format and apply appropriate parser
 */
interface DiffOptions {
	strict?: boolean;
	enableTelemetry?: boolean;
	matchingStrategies?: MatchingStrategy[];
	fuzzyThreshold?: number;
}

export function applyDiffUniversal(originalContent: string, diffContent: string, options?: DiffOptions): DiffResult {
	// Check if it's a search/replace format
	if (diffContent.includes('<<<<<<< SEARCH') && diffContent.includes('>>>>>>> REPLACE')) {
		return applySearchReplaceDiff(originalContent, diffContent, options);
	}
	
	// Check if it's a unified diff format
	if (diffContent.includes('@@') || diffContent.includes('---') || diffContent.includes('+++')) {
		// Unified diff still returns string, so wrap it
		const content = applyUnifiedDiff(originalContent, diffContent, options);
		return {
			content,
			results: {
				blocksTotal: 1,
				blocksApplied: 1,
				blocksFailed: 0,
				errors: [],
				warnings: []
			}
		};
	}
	
	throw new Error('Unknown diff format');
}

/**
 * Format types for explicit usage
 */
export enum DiffFormat {
	UNIFIED = 'unified',
	SEARCH_REPLACE = 'search-replace',
	DIFF_MATCH_PATCH = 'diff-match-patch'
}

/**
 * Apply diff with explicit format specification
 */
export function applyDiffWithFormat(
	originalContent: string,
	diffContent: string,
	format: DiffFormat,
	options?: DiffOptions
): DiffResult {
	switch (format) {
		case DiffFormat.UNIFIED:
			// Unified diff returns string, so wrap it
			const content = applyUnifiedDiff(originalContent, diffContent, options);
			return {
				content,
				results: {
					blocksTotal: 1,
					blocksApplied: 1,
					blocksFailed: 0,
					errors: [],
					warnings: []
				}
			};
		case DiffFormat.SEARCH_REPLACE:
			return applySearchReplaceDiff(originalContent, diffContent, options);
		default:
			throw new Error(`Unknown diff format: ${format}`);
	}
}