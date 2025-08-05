/**
 * Benchmark runner with RealtimeCodeFixer integration
 * Professional implementation with proper error handling and progress tracking
 */

import type { 
    IBenchmarkRunner, 
    IProgressReporter, 
    IResultsManager,
    ICodeFixer 
} from '../core/interfaces/benchmark.js';
import type { 
    BenchmarkConfiguration,
    ModelResult,
    ComprehensiveBenchmarkResults,
    BenchmarkProgress,
    CategoryResults,
    CategoryStatistics,
    OverallStatistics
} from '../core/types/benchmark.js';
import type { AlgorithmCategory, ModelConfiguration } from '../core/types/common.js';
import { TestSuiteFactory } from './test-runner.js';
import { CLIUtils } from '../utils/cli.js';
import { safeExecutor } from '../utils/timeout.js';
import { TIMEOUTS } from '../core/constants/config.js';

export class BenchmarkRunner implements IBenchmarkRunner {
    private testFactory = new TestSuiteFactory();
    private progress: BenchmarkProgress;
    private isCancelled = false;

    constructor(
        private config: BenchmarkConfiguration,
        private progressReporter: IProgressReporter,
        private resultsManager: IResultsManager,
        private codeFixer: ICodeFixer
    ) {
        this.progress = this.initializeProgress();
    }

    async runComprehensiveBenchmark(): Promise<ComprehensiveBenchmarkResults> {
        const startTime = performance.now();
        CLIUtils.log('info', 'Starting comprehensive benchmark suite');

        try {
            // Validate configuration
            await this.validateConfiguration();

            const categoryResults: CategoryResults[] = [];
            let completedTests = 0;

            // Run benchmarks for each enabled algorithm category
            for (const category of this.config.algorithms.filter(alg => alg.enabled)) {
                if (this.isCancelled) break;

                this.progress.currentCategory = category.name;
                CLIUtils.log('info', `\\n🔬 TESTING CATEGORY: ${category.name.toUpperCase()}`);

                const categoryResult = await this.runCategoryBenchmark(category);
                categoryResults.push(categoryResult);

                completedTests += categoryResult.modelResults.length;
                this.progress.completedTests = completedTests;
                this.progressReporter.reportProgress(this.progress);
            }

            // Calculate overall statistics
            const overallStats = this.calculateOverallStatistics(categoryResults);
            const executionTime = performance.now() - startTime;

            const results: ComprehensiveBenchmarkResults = {
                timestamp: new Date().toISOString(),
                config: this.config,
                categoryResults,
                overallStats,
                summary: this.generateSummary(categoryResults, overallStats, executionTime),
                executionTime
            };

            // Save results
            await this.resultsManager.saveResults(results);
            this.progressReporter.reportCompletion(results);

            return results;

        } catch (error: any) {
            this.progressReporter.reportError(error.message);
            throw error;
        }
    }

    async runSingleBenchmark(
        category: AlgorithmCategory,
        model: ModelConfiguration,
        iteration: number
    ): Promise<ModelResult> {
        const startTime = performance.now();
        this.progress.currentModel = model.name;
        this.progress.currentIteration = iteration;

        CLIUtils.log('info', `  📝 Testing ${model.name} - Iteration ${iteration}`);

        try {
            // Step 1: Run baseline test (before fix)
            CLIUtils.log('debug', '    🔍 Running baseline test...');
            const beforeFixResult = await this.runBaselineTest(category);
            
            CLIUtils.log('info', 
                `       Baseline: ${beforeFixResult.passed}/${beforeFixResult.total} tests passed (${beforeFixResult.successRate.toFixed(1)}%)`
            );

            // Step 2: Apply RealtimeCodeFixer
            CLIUtils.log('debug', '    🔧 Applying RealtimeCodeFixer...');
            const fixResult = await this.applyCodeFixer(category, model);

            // Step 3: Test the fixed code
            let afterFixResult = null;
            let fixSuccessful = false;

            if (fixResult.success && fixResult.fixedCode !== fixResult.originalCode) {
                CLIUtils.log('debug', '    🧪 Testing fixed code...');
                afterFixResult = await this.runFixedCodeTest(category, fixResult.fixedCode);
                
                if (afterFixResult) {
                    fixSuccessful = afterFixResult.successRate > beforeFixResult.successRate;
                    CLIUtils.log('info', 
                        `       Fixed: ${afterFixResult.passed}/${afterFixResult.total} tests passed (${afterFixResult.successRate.toFixed(1)}%)`
                    );
                }
            } else {
                CLIUtils.log('warn', '    ⚠️  No changes made by RealtimeCodeFixer');
            }

            const improvement = afterFixResult ? afterFixResult.successRate - beforeFixResult.successRate : 0;
            const executionTime = performance.now() - startTime;

            const modelResult: ModelResult = {
                modelName: model.name,
                modelId: model.id,
                category: category.name,
                categoryId: category.id,
                iteration,
                beforeFix: beforeFixResult,
                afterFix: afterFixResult,
                improvement,
                fixSuccessful,
                executionTime,
                errors: afterFixResult?.errors || [],
                rawOutputs: {
                    originalCode: fixResult.originalCode,
                    llmGeneratedDiff: fixResult.llmDiff,
                    finalFixedCode: fixResult.fixedCode,
                    diffApplicationLogs: fixResult.diffLogs
                }
            };

            // Save detailed result
            await this.resultsManager.saveModelResult(modelResult);

            CLIUtils.log('info', 
                `     ${fixSuccessful ? '✅' : '❌'} Fix: ${fixSuccessful ? 'SUCCESS' : 'FAILED'} (${improvement.toFixed(1)}% improvement)`
            );

            return modelResult;

        } catch (error: any) {
            CLIUtils.log('error', `    ❌ Benchmark failed: ${error.message}`);
            
            return {
                modelName: model.name,
                modelId: model.id,
                category: category.name,
                categoryId: category.id,
                iteration,
                beforeFix: this.getEmptyBenchmarkResult(),
                afterFix: null,
                improvement: 0,
                fixSuccessful: false,
                executionTime: performance.now() - startTime,
                errors: [error.message],
                rawOutputs: {
                    originalCode: '',
                    llmGeneratedDiff: '',
                    finalFixedCode: '',
                    diffApplicationLogs: []
                }
            };
        }
    }

    getProgress(): BenchmarkProgress {
        return { ...this.progress };
    }

    async cancel(): Promise<void> {
        this.isCancelled = true;
        CLIUtils.log('warn', 'Benchmark cancellation requested');
    }

    private async validateConfiguration(): Promise<void> {
        // Validate that code fixer is properly configured
        const isValid = await this.codeFixer.validateConfiguration();
        if (!isValid) {
            throw new Error('RealtimeCodeFixer is not properly configured. Check your API keys and configuration.');
        }

        // Validate algorithm categories
        for (const category of this.config.algorithms) {
            const runner = await this.testFactory.createRunner(category.id);
            const isValidCategory = await runner.validateCategory(category);
            if (!isValidCategory) {
                throw new Error(`Algorithm category '${category.name}' is not properly configured`);
            }
        }

        CLIUtils.log('info', 'Configuration validation passed');
    }

    private async runCategoryBenchmark(category: AlgorithmCategory): Promise<CategoryResults> {
        const modelResults: ModelResult[] = [];

        // Run benchmarks for each enabled model
        for (const model of this.config.models.filter(m => m.enabled)) {
            if (this.isCancelled) break;

            // Run multiple iterations if configured
            for (let iteration = 1; iteration <= this.config.iterations; iteration++) {
                if (this.isCancelled) break;

                const result = await safeExecutor.executeWithRetry(
                    () => this.runSingleBenchmark(category, model, iteration),
                    this.config.maxRetries,
                    category.timeoutMs || this.config.timeoutMs,
                    `Benchmark: ${category.name} with ${model.name} (iteration ${iteration})`
                );

                if (result.success && result.data) {
                    modelResults.push(result.data);
                } else {
                    CLIUtils.log('error', `Failed to run benchmark: ${result.error}`);
                }
            }
        }

        const statistics = this.calculateCategoryStatistics(modelResults);

        return {
            category,
            modelResults,
            statistics
        };
    }

    private async runBaselineTest(category: AlgorithmCategory) {
        const runner = await this.testFactory.createRunner(category.id);
        const context = {
            timeout: category.timeoutMs || TIMEOUTS.TEST_EXECUTION,
            maxRetries: 1,
            verbose: this.config.verbose,
            dryRun: this.config.dryRun
        };

        const result = await runner.runTestSuite(category, context);
        if (!result.success || !result.data) {
            throw new Error(`Baseline test failed: ${result.error}`);
        }

        return result.data;
    }

    private async applyCodeFixer(
        category: AlgorithmCategory, 
        model: ModelConfiguration
    ): Promise<{
        success: boolean;
        originalCode: string;
        fixedCode: string;
        llmDiff: string;
        diffLogs: string[];
    }> {
        const { readFileSync, writeFileSync, mkdirSync, existsSync } = await import('fs');
        const { join } = await import('path');
        
        const originalCode = readFileSync(category.enginePath, 'utf-8');
        const result = await this.codeFixer.fixCode(originalCode, category, model.provider);

        // Save original and fixed code files for inspection
        try {
            const tempDir = join(this.config.outputDir, 'temp');
            if (!existsSync(tempDir)) {
                mkdirSync(tempDir, { recursive: true });
            }
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseFileName = `${category.id}-${model.id}-${timestamp}`;
            
            // Save original code
            const originalPath = join(tempDir, `${baseFileName}-original.ts`);
            writeFileSync(originalPath, originalCode);
            
            // Save fixed code
            const fixedPath = join(tempDir, `${baseFileName}-fixed.ts`);
            writeFileSync(fixedPath, result.fixedCode);
            
            // Save diff log
            const diffPath = join(tempDir, `${baseFileName}-diff.txt`);
            const diffContent = [
                `=== REALTIMECODEFIXER DIFF LOG ===`,
                `Category: ${category.name}`,
                `Model: ${model.name}`,
                `Timestamp: ${new Date().toISOString()}`,
                `Success: ${result.success}`,
                ``,
                `=== LLM GENERATED DIFF ===`,
                result.llmDiff,
                ``,
                `=== DIFF APPLICATION LOGS ===`,
                ...result.diffLogs
            ].join('\n');
            writeFileSync(diffPath, diffContent);
            
            CLIUtils.log('info', `Saved code inspection files to ${tempDir}:`);
            CLIUtils.log('info', `  - Original: ${baseFileName}-original.ts`);
            CLIUtils.log('info', `  - Fixed: ${baseFileName}-fixed.ts`);
            CLIUtils.log('info', `  - Diff: ${baseFileName}-diff.txt`);
            
        } catch (error: any) {
            CLIUtils.log('error', `Failed to save inspection files: ${error.message}`);
        }

        return {
            success: result.success,
            originalCode,
            fixedCode: result.fixedCode,
            llmDiff: result.llmDiff,
            diffLogs: result.diffLogs
        };
    }

    private async runFixedCodeTest(category: AlgorithmCategory, fixedCode: string) {
        try {
            const { writeFileSync, readFileSync } = await import('fs');
            const originalPath = category.enginePath;
            
            // Backup original file
            const originalCode = readFileSync(originalPath, 'utf-8');
            
            try {
                // Replace the original file with fixed code temporarily
                writeFileSync(originalPath, fixedCode);
                
                // Import the fixed engine directly
                const { BrokenSortingEngine } = await import(originalPath + '?t=' + Date.now());
                const fixedEngine = new BrokenSortingEngine();
                
                // Create test suite with fixed engine
                const { SortingAlgorithmsBenchmark } = await import('../test-suites/sorting-algorithms-test.js');
                const customTestSuite = new SortingAlgorithmsBenchmark(fixedEngine);
                
                // Run tests with timeout protection
                const timeoutMs = category.timeoutMs || TIMEOUTS.TEST_EXECUTION;
                const result = await Promise.race([
                    customTestSuite.runBenchmark(),
                    new Promise<null>((_, reject) => {
                        setTimeout(() => {
                            reject(new Error('Fixed code test execution timed out'));
                        }, timeoutMs);
                    })
                ]);
                
                return result;
                
            } finally {
                // Always restore the original file
                writeFileSync(originalPath, originalCode);
            }
            
        } catch (error: any) {
            CLIUtils.log('error', `Fixed code test failed: ${error.message}`);
            return null;
        }
    }

    private calculateCategoryStatistics(modelResults: ModelResult[]): CategoryStatistics {
        if (modelResults.length === 0) {
            return {
                averageImprovement: 0,
                successRate: 0,
                bestModel: 'None',
                worstModel: 'None',
                totalTests: 0,
                totalImprovements: 0
            };
        }

        const totalImprovements = modelResults.filter(r => r.improvement > 0).length;
        const averageImprovement = modelResults.reduce((sum, r) => sum + r.improvement, 0) / modelResults.length;
        const successRate = (totalImprovements / modelResults.length) * 100;

        // Find best and worst models
        const modelScores = new Map<string, number>();
        modelResults.forEach(result => {
            const current = modelScores.get(result.modelName) || 0;
            modelScores.set(result.modelName, current + result.improvement);
        });

        let bestModel = 'None';
        let worstModel = 'None';
        let bestScore = -Infinity;
        let worstScore = Infinity;

        for (const [model, score] of modelScores) {
            if (score > bestScore) {
                bestScore = score;
                bestModel = model;
            }
            if (score < worstScore) {
                worstScore = score;
                worstModel = model;
            }
        }

        return {
            averageImprovement,
            successRate,
            bestModel,
            worstModel,
            totalTests: modelResults.length,
            totalImprovements
        };
    }

    private calculateOverallStatistics(categoryResults: CategoryResults[]): OverallStatistics {
        const allResults = categoryResults.flatMap(cat => cat.modelResults);
        
        if (allResults.length === 0) {
            return {
                totalTests: 0,
                totalImprovements: 0,
                averageImprovement: 0,
                bestModel: 'None',
                worstModel: 'None',
                bestCategory: 'None',
                worstCategory: 'None'
            };
        }

        const totalTests = allResults.length;
        const totalImprovements = allResults.filter(r => r.improvement > 0).length;
        const averageImprovement = allResults.reduce((sum, r) => sum + r.improvement, 0) / totalTests;

        // Find best model overall
        const modelScores = new Map<string, number>();
        allResults.forEach(result => {
            const current = modelScores.get(result.modelName) || 0;
            modelScores.set(result.modelName, current + result.improvement);
        });

        let bestModel = 'None';
        let worstModel = 'None';
        let bestModelScore = -Infinity;
        let worstModelScore = Infinity;

        for (const [model, score] of modelScores) {
            if (score > bestModelScore) {
                bestModelScore = score;
                bestModel = model;
            }
            if (score < worstModelScore) {
                worstModelScore = score;
                worstModel = model;
            }
        }

        // Find best category
        let bestCategory = 'None';
        let worstCategory = 'None';
        let bestCategoryScore = -Infinity;
        let worstCategoryScore = Infinity;

        categoryResults.forEach(catResult => {
            const score = catResult.statistics.averageImprovement;
            if (score > bestCategoryScore) {
                bestCategoryScore = score;
                bestCategory = catResult.category.name;
            }
            if (score < worstCategoryScore) {
                worstCategoryScore = score;
                worstCategory = catResult.category.name;
            }
        });

        return {
            totalTests,
            totalImprovements,
            averageImprovement,
            bestModel,
            worstModel,
            bestCategory,
            worstCategory
        };
    }

    private generateSummary(
        categoryResults: CategoryResults[],
        overallStats: OverallStatistics,
        executionTime: number
    ): string {
        const lines = [
            'COMPREHENSIVE BENCHMARK RESULTS',
            '=' .repeat(50),
            '',
            `🎯 Overall Performance:`,
            `   • Total Tests: ${overallStats.totalTests}`,
            `   • Successful Improvements: ${overallStats.totalImprovements}`,
            `   • Average Improvement: ${overallStats.averageImprovement.toFixed(1)}%`,
            `   • Best Model: ${overallStats.bestModel}`,
            `   • Best Category: ${overallStats.bestCategory}`,
            `   • Execution Time: ${CLIUtils.formatDuration(executionTime)}`,
            '',
            `📊 Category Breakdown:`
        ];

        for (const catResult of categoryResults) {
            const stats = catResult.statistics;
            lines.push(`   • ${catResult.category.name}: ${stats.averageImprovement.toFixed(1)}% avg improvement, ${stats.successRate.toFixed(1)}% success rate`);
        }

        return lines.join('\\n');
    }

    private initializeProgress(): BenchmarkProgress {
        const totalCategories = this.config.algorithms.filter(alg => alg.enabled).length;
        const totalModels = this.config.models.filter(m => m.enabled).length;
        const totalTests = totalCategories * totalModels * this.config.iterations;

        return {
            currentCategory: '',
            currentModel: '',
            currentIteration: 0,
            totalCategories,
            totalModels,
            totalIterations: this.config.iterations,
            completedTests: 0,
            totalTests,
            elapsedTime: 0
        };
    }

    private getEmptyBenchmarkResult() {
        return {
            suiteName: 'Empty',
            passed: 0,
            total: 0,
            successRate: 0,
            errors: [],
            executionTime: 0,
            details: []
        };
    }
}