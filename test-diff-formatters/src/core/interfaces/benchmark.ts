/**
 * Core interfaces for the benchmark suite
 */

import type { AlgorithmCategory } from '../types/common.js';

export interface ICodeFixer {
    fixCode(
        originalCode: string,
        category: AlgorithmCategory,
        modelId: string
    ): Promise<{
        fixedCode: string;
        llmDiff: string;
        diffLogs: string[];
        success: boolean;
    }>;
    
    validateConfiguration(): Promise<boolean>;
}