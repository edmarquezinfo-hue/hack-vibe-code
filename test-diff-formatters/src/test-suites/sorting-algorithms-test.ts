#!/usr/bin/env bun

/**
 * Test suite for broken sorting algorithms
 * This should fail significantly without LLM fixes
 */

import { BrokenSortingEngine } from '../engines/broken-sorting-algorithms';

export interface TestResult {
    testName: string;
    passed: boolean;
    error?: string;
    executionTime: number;
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

export class SortingAlgorithmsBenchmark {
    private engine: BrokenSortingEngine;

    constructor(customEngine?: BrokenSortingEngine) {
        this.engine = customEngine || new BrokenSortingEngine();
    }

    async runBenchmark(): Promise<BenchmarkResult> {
        const startTime = performance.now();
        const tests: TestResult[] = [];
        let passed = 0;
        const errors: string[] = [];

        // Check if this is a quick mode run based on environment
        const isQuickMode = process.env.QUICK_MODE === 'true' || process.argv.includes('-q') || process.argv.includes('--quick');
        
        console.log('🚀 Starting Broken Sorting Algorithms Test Suite');
        if (isQuickMode) {
            console.log('⚡ Quick Mode: Testing 2 sorting algorithms with 2 data types and 1 size each (4 total tests)');
        } else {
            console.log('📊 Testing 7 sorting algorithms with 4 data types and 3 sizes each (84 total tests)');
        }
        
        let algorithms, dataTypes, sizes;
        
        if (isQuickMode) {
            algorithms = ['quickSort', 'bubbleSort']; // Only 2 algorithms for quick mode
            dataTypes = ['random', 'reversed'] as const; // Only 2 data types for quick mode
            sizes = [10]; // Only 1 size for quick mode
        } else {
            algorithms = ['quickSort', 'mergeSort', 'heapSort', 'bubbleSort', 'selectionSort', 'insertionSort', 'radixSort'];
            dataTypes = ['random', 'reversed', 'nearly_sorted', 'duplicates'] as const;
            sizes = [10, 50, 100];
        }

        let testCount = 1;
        const totalTests = algorithms.length * dataTypes.length * sizes.length;

        for (const algorithm of algorithms) {
            for (const dataType of dataTypes) {
                for (const size of sizes) {
                    const testName = `${algorithm}_${dataType}_${size}`;
                    if (testCount % 10 === 1) { // Log every 10th test to reduce noise
                        console.log(`🧪 Test ${testCount}/${totalTests}: ${testName}`);
                    }

                    const testStart = performance.now();
                    try {
                        const testData = this.engine.generateTestData(size, dataType);
                        const originalData = [...testData];
                        
                        // Execute with very aggressive timeout to prevent hanging
                        const timeoutMs = isQuickMode ? 50 : 75; // Even more aggressive: 50ms quick, 75ms full
                        const result = await Promise.race([
                            Promise.resolve((this.engine as any)[algorithm](testData)),
                            new Promise((_, reject) => {
                                setTimeout(() => {
                                    reject(new Error('Algorithm execution timed out'));
                                }, timeoutMs);
                            })
                        ]);
                        
                        const isCorrect = this.engine.isSorted(result.sortedArray);
                        const isValidLength = result.sortedArray.length === originalData.length;
                        const hasAllElements = this.hasAllElements(originalData, result.sortedArray);

                        if (isCorrect && isValidLength && hasAllElements) {
                            passed++;
                            tests.push({
                                testName,
                                passed: true,
                                executionTime: performance.now() - testStart
                            });
                            if (testCount % 20 === 0) { // Only log some passes to reduce noise
                                console.log(`   ✅ PASSED (${result.comparisons} comparisons, ${result.swaps} swaps)`);
                            }
                        } else {
                            let error = '';
                            if (!isCorrect) {
                                error = `Array not sorted correctly. Input: [${originalData.slice(0, 10).join(', ')}${originalData.length > 10 ? '...' : ''}], Got: [${result.sortedArray.slice(0, 10).join(', ')}${result.sortedArray.length > 10 ? '...' : ''}], Expected: [${[...originalData].sort((a, b) => a - b).slice(0, 10).join(', ')}${originalData.length > 10 ? '...' : ''}]`;
                            } else if (!isValidLength) {
                                error = `Array length changed. Input length: ${originalData.length}, Output length: ${result.sortedArray.length}`;
                            } else {
                                error = `Missing or extra elements. Input: [${originalData.slice(0, 10).join(', ')}${originalData.length > 10 ? '...' : ''}], Output: [${result.sortedArray.slice(0, 10).join(', ')}${result.sortedArray.length > 10 ? '...' : ''}]`;
                            }
                            
                            errors.push(`${testName}: ${error}`);
                            tests.push({
                                testName,
                                passed: false,
                                error,
                                executionTime: performance.now() - testStart
                            });
                            if (testCount % 10 === 0 || errors.length < 5) { // Log some failures
                                console.log(`   ❌ FAILED: ${error}`);
                            }
                        }
                    } catch (error: any) {
                        const errorMsg = `Exception: ${error.message}`;
                        errors.push(`${testName}: ${errorMsg}`);
                        tests.push({
                            testName,
                            passed: false,
                            error: errorMsg,
                            executionTime: performance.now() - testStart
                        });
                        if (testCount % 5 === 0) { // Log some exceptions to track progress
                            console.log(`   ❌ FAILED: ${errorMsg}`);
                        }
                    }
                    testCount++;
                }
            }
        }

        const executionTime = performance.now() - startTime;
        const successRate = (passed / totalTests) * 100;

        console.log('\\n📊 SORTING ALGORITHMS BENCHMARK RESULTS');
        console.log('=' .repeat(50));
        console.log(`📈 Tests Passed: ${passed}/${totalTests} (${successRate.toFixed(1)}%)`);
        console.log(`⏱️  Total Execution Time: ${executionTime.toFixed(2)}ms`);
        console.log(`🎯 Overall Grade: ${this.calculateGrade(successRate)}`);

        if (errors.length > 0) {
            console.log(`\\n❌ Errors (${errors.length}):`);
            errors.slice(0, 10).forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
            if (errors.length > 10) {
                console.log(`   ... and ${errors.length - 10} more errors`);
            }
        }

        return {
            suiteName: 'Broken Sorting Algorithms',
            passed,
            total: totalTests,
            successRate,
            errors,
            executionTime,
            details: tests
        };
    }

    private hasAllElements(original: number[], sorted: number[]): boolean {
        const originalCounts = new Map<number, number>();
        const sortedCounts = new Map<number, number>();

        for (const num of original) {
            originalCounts.set(num, (originalCounts.get(num) || 0) + 1);
        }

        for (const num of sorted) {
            sortedCounts.set(num, (sortedCounts.get(num) || 0) + 1);
        }

        if (originalCounts.size !== sortedCounts.size) return false;

        for (const [num, count] of originalCounts) {
            if (sortedCounts.get(num) !== count) return false;
        }

        return true;
    }

    private calculateGrade(successRate: number): string {
        if (successRate >= 90) return 'A';
        if (successRate >= 80) return 'B';
        if (successRate >= 70) return 'C';
        if (successRate >= 60) return 'D';
        return 'F';
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const benchmark = new SortingAlgorithmsBenchmark();
    
    // Set a global timeout to ensure we always output JSON
    const globalTimeout = setTimeout(() => {
        console.error('⏰ Global timeout reached - outputting partial results');
        console.log(JSON.stringify({
            passed: 0,
            total: 4,
            successRate: 0,
            errors: ['Global timeout: Test suite took too long to complete']
        }));
        process.exit(1);
    }, 4000);
    
    benchmark.runBenchmark().then(result => {
        clearTimeout(globalTimeout);
        // Output JSON result for subprocess parsing
        console.log(JSON.stringify({
            passed: result.passed,
            total: result.total,
            successRate: result.successRate,
            errors: result.errors
        }));
        process.exit(result.successRate < 10 ? 0 : 1); // Exit successfully if very low success rate (as expected)
    }).catch(error => {
        clearTimeout(globalTimeout);
        console.error('❌ Benchmark failed:', error);
        // Output error result as JSON
        console.log(JSON.stringify({
            passed: 0,
            total: 4,
            successRate: 0,
            errors: [error.message]
        }));
        process.exit(1);
    });
}