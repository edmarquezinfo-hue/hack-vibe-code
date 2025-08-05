/**
 * Common types for the benchmark suite
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AlgorithmCategory {
    id: string;
    name: string;
    description: string;
    enginePath: string;
    testSuitePath: string;
    enabled: boolean;
    timeoutMs?: number;
}

export interface BenchmarkResult {
    suiteName: string;
    passed: number;
    total: number;
    successRate: number;
    errors: string[];
    executionTime: number;
    details: TestResult[];
}

export interface TestResult {
    testName: string;
    passed: boolean;
    error?: string;
    executionTime: number;
}

export interface SafeExecutionResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    timedOut: boolean;
    executionTime: number;
}

export interface ExecutionContext {
    timeout: number;
    maxRetries: number;
    verbose: boolean;
    dryRun: boolean;
}