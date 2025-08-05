/**
 * Professional test runner with safe execution and timeout protection
 * Prevents hanging and provides proper error handling
 */

import type { 
    ITestRunner, 
    ITestSuiteFactory 
} from '../core/interfaces/test-runner.js';
import type { 
    BenchmarkResult, 
    AlgorithmCategory, 
    ExecutionContext, 
    SafeExecutionResult 
} from '../core/types/common.js';
import { safeExecutor } from '../utils/timeout.js';
import { CLIUtils } from '../utils/cli.js';
import { ALGORITHM_CATEGORIES } from '../core/constants/config.js';
import { existsSync } from 'fs';

/**
 * Safe test runner that prevents hanging from broken algorithms
 */
export class SafeTestRunner implements ITestRunner {
    constructor(
        private categoryId: string,
        private category: AlgorithmCategory
    ) {}

    async runTestSuite(
        category: AlgorithmCategory, 
        context: ExecutionContext
    ): Promise<SafeExecutionResult<BenchmarkResult>> {
        CLIUtils.log('info', `Starting test suite for ${category.name}`);
        
        // Validate category first
        const isValid = await this.validateCategory(category);
        if (!isValid) {
            return {
                success: false,
                error: `Category ${category.name} validation failed`,
                timedOut: false,
                executionTime: 0
            };
        }

        // Execute test suite with safety measures
        const testFunction = async (): Promise<BenchmarkResult> => {
            return await this.executeTestSuite(category, context);
        };

        return await safeExecutor.executeWithRetry(
            testFunction,
            context.maxRetries,
            category.timeoutMs || context.timeout,
            `Test suite: ${category.name}`
        );
    }

    async validateCategory(category: AlgorithmCategory): Promise<boolean> {
        // Check if engine file exists
        if (!existsSync(category.enginePath)) {
            CLIUtils.log('error', `Engine file not found: ${category.enginePath}`);
            return false;
        }

        // Check if test suite file exists
        if (!existsSync(category.testSuitePath)) {
            CLIUtils.log('error', `Test suite file not found: ${category.testSuitePath}`);
            return false;
        }

        // Check if category is enabled
        if (!category.enabled) {
            CLIUtils.log('warn', `Category ${category.name} is disabled`);
            return false;
        }

        return true;
    }

    getDisplayName(): string {
        return `SafeTestRunner(${this.category.name})`;
    }

    private async executeTestSuite(
        category: AlgorithmCategory, 
        context: ExecutionContext
    ): Promise<BenchmarkResult> {
        const startTime = performance.now();

        try {
            // Import and run the specific test suite with timeout
            const testSuite = await this.importTestSuite(category);
            
            // Execute with timeout protection
            const timeoutMs = category.timeoutMs || context.timeout;
            const result = await Promise.race([
                testSuite.runBenchmark(),
                new Promise<BenchmarkResult>((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Test suite timed out after ${timeoutMs}ms`));
                    }, timeoutMs);
                })
            ]);
            
            CLIUtils.log('info', 
                `Test suite completed: ${result.passed}/${result.total} tests passed (${result.successRate.toFixed(1)}%)`
            );

            return {
                ...result,
                executionTime: performance.now() - startTime
            };

        } catch (error: any) {
            CLIUtils.log('error', `Test suite execution failed: ${error.message}`);
            
            return {
                suiteName: category.name,
                passed: 0,
                total: 0,
                successRate: 0,
                errors: [error.message],
                executionTime: performance.now() - startTime,
                details: []
            };
        }
    }

    private async importTestSuite(category: AlgorithmCategory): Promise<any> {
        switch (category.id) {
            case 'sorting':
                const { SortingAlgorithmsBenchmark } = await import('../test-suites/sorting-algorithms-test.js');
                return new SortingAlgorithmsBenchmark();
                
            case 'graph':
                const { GraphAlgorithmsBenchmark } = await import('../test-suites/graph-algorithms-test.js');
                return new GraphAlgorithmsBenchmark();
                
            case 'data-structures':
                const { DataStructuresBenchmark } = await import('../test-suites/data-structures-test.js');
                return new DataStructuresBenchmark();
                
            case 'pathfinding':
                const { PathfindingBenchmark } = await import('../test-suites/pathfinding-test.js');
                return new PathfindingBenchmark();
                
            case 'game-engine':
                const { GameEngineBenchmark } = await import('../test-suites/game-engine-test.js');
                return new GameEngineBenchmark();
                
            default:
                throw new Error(`Unknown test suite for category: ${category.id}`);
        }
    }
}

/**
 * Factory for creating test runners
 */
export class TestSuiteFactory implements ITestSuiteFactory {
    async createRunner(categoryId: string): Promise<ITestRunner> {
        const category = ALGORITHM_CATEGORIES.find(cat => cat.id === categoryId);
        
        if (!category) {
            throw new Error(`Unknown category: ${categoryId}`);
        }

        return new SafeTestRunner(categoryId, category);
    }

    getSupportedCategories(): string[] {
        return ALGORITHM_CATEGORIES
            .filter(cat => cat.enabled)
            .map(cat => cat.id);
    }

    isSupported(categoryId: string): boolean {
        return this.getSupportedCategories().includes(categoryId);
    }
}

/**
 * Test validation runner - only runs tests to verify they work/fail appropriately
 */
export class TestValidationRunner {
    private factory = new TestSuiteFactory();

    async validateAllCategories(verbose: boolean = false): Promise<{
        passed: number;
        total: number;
        results: Array<{
            category: string;
            success: boolean;
            successRate: number;
            error?: string;
            executionTime: number;
        }>;
    }> {
        const categories = ALGORITHM_CATEGORIES.filter(cat => cat.enabled);
        const results = [];
        let passed = 0;

        CLIUtils.log('info', `Validating ${categories.length} test categories...`);

        for (const category of categories) {
            CLIUtils.log('info', `\\n🧪 Validating ${category.name}...`);
            
            try {
                const runner = await this.factory.createRunner(category.id);
                const context: ExecutionContext = {
                    timeout: category.timeoutMs || 1000, // Very aggressive timeout
                    maxRetries: 1,
                    verbose,
                    dryRun: false
                };

                const result = await runner.runTestSuite(category, context);
                
                if (result.success && result.data) {
                    const successRate = result.data.successRate;
                    const isExpectedFailure = successRate < 10; // Expect very low success rate for broken algorithms
                    
                    results.push({
                        category: category.name,
                        success: isExpectedFailure,
                        successRate,
                        executionTime: result.executionTime
                    });
                    
                    if (isExpectedFailure) {
                        passed++;
                        CLIUtils.log('info', `   ✅ VALIDATED: ${successRate.toFixed(1)}% success rate (appropriately low)`);
                    } else {
                        CLIUtils.log('warn', `   ⚠️  WARNING: ${successRate.toFixed(1)}% success rate (unexpectedly high for broken algorithms)`);
                    }
                } else {
                    results.push({
                        category: category.name,
                        success: false,
                        successRate: 0,
                        error: result.error || 'Unknown error',
                        executionTime: result.executionTime
                    });
                    
                    CLIUtils.log('error', `   ❌ FAILED: ${result.error || 'Unknown error'}`);
                }
                
            } catch (error: any) {
                results.push({
                    category: category.name,
                    success: false,
                    successRate: 0,
                    error: error.message,
                    executionTime: 0
                });
                
                CLIUtils.log('error', `   ❌ ERROR: ${error.message}`);
            }
        }

        return {
            passed,
            total: categories.length,
            results
        };
    }

    async validateSingleCategory(
        categoryId: string, 
        verbose: boolean = false
    ): Promise<SafeExecutionResult<BenchmarkResult>> {
        const category = ALGORITHM_CATEGORIES.find(cat => cat.id === categoryId);
        
        if (!category) {
            return {
                success: false,
                error: `Category not found: ${categoryId}`,
                timedOut: false,
                executionTime: 0
            };
        }

        CLIUtils.log('info', `Validating ${category.name}...`);
        
        const runner = await this.factory.createRunner(categoryId);
        const context: ExecutionContext = {
            timeout: category.timeoutMs || 1000, // Very aggressive timeout
            maxRetries: 1,
            verbose,
            dryRun: false
        };

        return await runner.runTestSuite(category, context);
    }
    
    async validateSpecificCategories(
        categoryIds: string[], 
        verbose: boolean = false
    ): Promise<{
        passed: number;
        total: number;
        results: Array<{
            category: string;
            success: boolean;
            successRate: number;
            error?: string;
            executionTime: number;
        }>;
    }> {
        const specificCategories = ALGORITHM_CATEGORIES.filter(cat => 
            cat.enabled && categoryIds.includes(cat.id)
        );
        const results = [];
        let passed = 0;

        CLIUtils.log('info', `Validating ${specificCategories.length} specific test categories...`);

        for (const category of specificCategories) {
            CLIUtils.log('info', `\\n🧪 Validating ${category.name}...`);
            
            try {
                const runner = await this.factory.createRunner(category.id);
                const context: ExecutionContext = {
                    timeout: category.timeoutMs || 1000, // Very aggressive timeout
                    maxRetries: 1,
                    verbose,
                    dryRun: false
                };

                const result = await runner.runTestSuite(category, context);
                
                if (result.success && result.data) {
                    const successRate = result.data.successRate;
                    const isExpectedFailure = successRate < 10; // Expect very low success rate for broken algorithms
                    
                    results.push({
                        category: category.name,
                        success: isExpectedFailure,
                        successRate,
                        executionTime: result.executionTime
                    });
                    
                    if (isExpectedFailure) {
                        passed++;
                        CLIUtils.log('info', `   ✅ VALIDATED: ${successRate.toFixed(1)}% success rate (appropriately low)`);
                    } else {
                        CLIUtils.log('warn', `   ⚠️  WARNING: ${successRate.toFixed(1)}% success rate (unexpectedly high for broken algorithms)`);
                    }
                } else {
                    results.push({
                        category: category.name,
                        success: false,
                        successRate: 0,
                        error: result.error || 'Unknown error',
                        executionTime: result.executionTime
                    });
                    
                    CLIUtils.log('error', `   ❌ FAILED: ${result.error || 'Unknown error'}`);
                }
                
            } catch (error: any) {
                results.push({
                    category: category.name,
                    success: false,
                    successRate: 0,
                    error: error.message,
                    executionTime: 0
                });
                
                CLIUtils.log('error', `   ❌ ERROR: ${error.message}`);
            }
        }

        return {
            passed,
            total: specificCategories.length,
            results
        };
    }
}