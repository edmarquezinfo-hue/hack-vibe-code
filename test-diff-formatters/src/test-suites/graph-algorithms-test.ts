#!/usr/bin/env bun

/**
 * Test suite for broken graph algorithms
 * This should fail significantly without RealtimeCodeFixer fixes
 */

import { BrokenGraphEngine } from '../engines/broken-graph-algorithms.js';

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

export class GraphAlgorithmsBenchmark {
    private engine: BrokenGraphEngine;

    constructor(customEngine?: BrokenGraphEngine) {
        this.engine = customEngine || new BrokenGraphEngine();
    }

    async runBenchmark(): Promise<BenchmarkResult> {
        const startTime = performance.now();
        const tests: TestResult[] = [];
        let passed = 0;
        const errors: string[] = [];

        // Quick mode for faster testing
        const isQuickMode = process.env.QUICK_MODE === 'true';
        console.log('🚀 Starting Graph Algorithms Test Suite');
        if (isQuickMode) {
            console.log('⚡ Quick Mode: Testing graph algorithms (6 total tests)');
        }

        // Test each algorithm
        const testMethods = [
            { name: 'Dijkstra', method: () => this.testDijkstra() },
            { name: 'BFS', method: () => this.testBFS() },
            { name: 'DFS', method: () => this.testDFS() },
            { name: 'MST', method: () => this.testMST() },
            { name: 'Topological Sort', method: () => this.testTopologicalSort() },
            { name: 'Floyd-Warshall', method: () => this.testFloydWarshall() }
        ];

        let testCount = 1;
        for (const testMethod of testMethods) {
            console.log(`🧪 Test ${testCount}/${testMethods.length}: ${testMethod.name}`);
            
            const testStart = performance.now();
            try {
                const result = await Promise.race([
                    testMethod.method(),
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Test timed out')), 5000);
                    })
                ]);

                const testResult = result as { success: boolean; error: string };
                if (testResult.success) {
                    passed++;
                    tests.push({
                        testName: testMethod.name,
                        passed: true,
                        executionTime: performance.now() - testStart
                    });
                    console.log(`   ✅ PASSED`);
                } else {
                    const error = testResult.error;
                    errors.push(`${testMethod.name}: ${error}`);
                    tests.push({
                        testName: testMethod.name,
                        passed: false,
                        error,
                        executionTime: performance.now() - testStart
                    });
                    console.log(`   ❌ FAILED: ${error}`);
                }
            } catch (error: any) {
                const errorMsg = `Exception: ${error.message}`;
                errors.push(`${testMethod.name}: ${errorMsg}`);
                tests.push({
                    testName: testMethod.name,
                    passed: false,
                    error: errorMsg,
                    executionTime: performance.now() - testStart
                });
                console.log(`   ❌ FAILED: ${errorMsg}`);
            }
            testCount++;
        }

        const executionTime = performance.now() - startTime;
        const totalTests = testMethods.length;
        const successRate = (passed / totalTests) * 100;

        console.log('\\n📊 GRAPH ALGORITHMS BENCHMARK RESULTS');
        console.log('=' .repeat(50));
        console.log(`📈 Tests Passed: ${passed}/${totalTests} (${successRate.toFixed(1)}%)`);
        console.log(`⏱️  Total Execution Time: ${executionTime.toFixed(2)}ms`);

        if (errors.length > 0) {
            console.log(`\\n❌ Errors (${errors.length}):`);
            errors.slice(0, 5).forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
        }

        return {
            suiteName: 'Broken Graph Algorithms',
            passed,
            total: totalTests,
            successRate,
            errors,
            executionTime,
            details: tests
        };
    }

    private async testDijkstra(): Promise<{ success: boolean; error: string }> {
        try {
            this.engine.clear();
            this.engine.addEdge('A', 'B', 1);
            this.engine.addEdge('B', 'C', 2);
            this.engine.addEdge('A', 'C', 4);
            
            const result = this.engine.dijkstra('A', 'C');
            const expectedPath = ['A', 'B', 'C'];
            const expectedDistance = 3;
            
            if (result.path.length !== expectedPath.length || result.distance !== expectedDistance) {
                return { success: false, error: `Dijkstra failed: expected path [${expectedPath}] with distance ${expectedDistance}, got path [${result.path}] with distance ${result.distance}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra test exception: ${error.message}` };
        }
    }

    private async testBFS(): Promise<{ success: boolean; error: string }> {
        try {
            this.engine.clear();
            this.engine.addEdge('A', 'B', 1);
            this.engine.addEdge('B', 'C', 1);
            this.engine.addEdge('A', 'D', 1);
            this.engine.addEdge('D', 'C', 1);
            
            const result = this.engine.breadthFirstSearch('A', 'C');
            
            if (result.distance !== 2) {
                return { success: false, error: `BFS failed: expected distance 2, got ${result.distance}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `BFS test exception: ${error.message}` };
        }
    }

    private async testDFS(): Promise<{ success: boolean; error: string }> {
        try {
            this.engine.clear();
            this.engine.addEdge('A', 'B', 1);
            this.engine.addEdge('B', 'C', 1);
            
            const result = this.engine.depthFirstSearch('A', 'C');
            
            if (!result.success || result.path.length === 0) {
                return { success: false, error: `DFS failed: could not find path from A to C` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `DFS test exception: ${error.message}` };
        }
    }

    private async testMST(): Promise<{ success: boolean; error: string }> {
        try {
            this.engine.clear();
            this.engine.addEdge('A', 'B', 1);
            this.engine.addEdge('B', 'C', 2);
            this.engine.addEdge('A', 'C', 3);
            
            const result = this.engine.kruskalMST();
            
            if (!result.success || result.totalWeight !== 3) {
                return { success: false, error: `MST failed: expected total weight 3, got ${result.totalWeight}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `MST test exception: ${error.message}` };
        }
    }

    private async testTopologicalSort(): Promise<{ success: boolean; error: string }> {
        try {
            this.engine.clear();
            this.engine.addNode('A');
            this.engine.addNode('B');
            this.engine.addNode('C');
            this.engine.addEdge('A', 'B', 1);
            this.engine.addEdge('B', 'C', 1);
            
            const result = this.engine.topologicalSort();
            
            if (!result.success || result.order.length !== 3) {
                return { success: false, error: `Topological sort failed: expected 3 nodes in order, got ${result.order.length}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Topological sort test exception: ${error.message}` };
        }
    }

    private async testFloydWarshall(): Promise<{ success: boolean; error: string }> {
        try {
            this.engine.clear();
            this.engine.addEdge('A', 'B', 1);
            this.engine.addEdge('B', 'C', 1);
            
            const distances = this.engine.floydWarshall();
            const distanceAC = distances.get('A')?.get('C');
            
            if (distanceAC !== 2) {
                return { success: false, error: `Floyd-Warshall failed: expected distance A->C = 2, got ${distanceAC}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Floyd-Warshall test exception: ${error.message}` };
        }
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const benchmark = new GraphAlgorithmsBenchmark();
    
    // Set a global timeout to ensure we always output JSON
    const globalTimeout = setTimeout(() => {
        console.error('⏰ Global timeout reached - outputting partial results');
        console.log(JSON.stringify({
            passed: 0,
            total: 6,
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
        process.exit(result.successRate < 10 ? 0 : 1);
    }).catch(error => {
        clearTimeout(globalTimeout);
        console.error('❌ Benchmark failed:', error);
        // Output error result as JSON
        console.log(JSON.stringify({
            passed: 0,
            total: 6,
            successRate: 0,
            errors: [error.message]
        }));
        process.exit(1);
    });
}