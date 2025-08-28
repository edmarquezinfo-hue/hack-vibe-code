#!/usr/bin/env bun

/**
 * Test suite for broken pathfinding algorithms
 * This should fail significantly without RealtimeCodeFixer fixes
 */

import { PathfindingEngine } from '../engines/pathfinding-engine.js';

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

export class PathfindingBenchmark {
    private engine: PathfindingEngine;

    constructor(customEngine?: PathfindingEngine) {
        this.engine = customEngine || new PathfindingEngine(20, 20);
    }

    async runBenchmark(): Promise<BenchmarkResult> {
        const startTime = performance.now();
        const tests: TestResult[] = [];
        let passed = 0;
        const errors: string[] = [];

        // Quick mode for faster testing
        const isQuickMode = process.env.QUICK_MODE === 'true';
        console.log('🚀 Starting Pathfinding Test Suite');
        if (isQuickMode) {
            console.log('⚡ Quick Mode: Testing pathfinding functionality (4 total tests)');
        }

        // Test pathfinding functionality
        const testMethods = [
            { name: 'Basic Path Finding', method: () => this.testBasicPathfinding() },
            { name: 'Path with Obstacles', method: () => this.testPathfindingWithObstacles() },
            { name: 'Multi-waypoint Path', method: () => this.testMultiWaypointPath() },
            { name: 'No Path Available', method: () => this.testNoPathScenario() }
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

                if (result.success) {
                    passed++;
                    tests.push({
                        testName: testMethod.name,
                        passed: true,
                        executionTime: performance.now() - testStart
                    });
                    console.log(`   ✅ PASSED`);
                } else {
                    const error = result.error;
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

        console.log('\\n📊 PATHFINDING BENCHMARK RESULTS');
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
            suiteName: 'Pathfinding Algorithms',
            passed,
            total: totalTests,
            successRate,
            errors,
            executionTime,
            details: tests
        };
    }

    private async testBasicPathfinding(): Promise<{ success: boolean; error: string }> {
        try {
            const result = this.engine.findPath({ x: 0, y: 0 }, { x: 5, y: 5 });
            
            if (!result.success || result.path.length === 0) {
                return { success: false, error: `Basic pathfinding failed: could not find path from (0,0) to (5,5)` };
            }
            
            // Check if path starts and ends correctly
            const firstPos = result.path[0];
            const lastPos = result.path[result.path.length - 1];
            
            if (firstPos.x !== 5 || firstPos.y !== 5 || lastPos.x !== 0 || lastPos.y !== 0) {
                return { success: false, error: `Path endpoints incorrect: expected start (5,5) and end (0,0), got start (${firstPos.x},${firstPos.y}) and end (${lastPos.x},${lastPos.y})` };
            }
            
            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Basic pathfinding exception: ${error.message}` };
        }
    }

    private async testPathfindingWithObstacles(): Promise<{ success: boolean; error: string }> {
        try {
            // Create a new engine for this test
            const testEngine = new PathfindingEngine(10, 10);
            
            // Add obstacles to block direct path
            testEngine.addObstacle(2, 2);
            testEngine.addObstacle(2, 3);
            testEngine.addObstacle(2, 4);
            
            const result = testEngine.findPath({ x: 0, y: 3 }, { x: 5, y: 3 });
            
            if (!result.success) {
                return { success: false, error: `Pathfinding with obstacles failed: could not find path around obstacles` };
            }
            
            // Path should be longer than direct distance due to obstacles
            if (result.path.length < 6) {
                return { success: false, error: `Path too short: expected path to navigate around obstacles, got length ${result.path.length}` };
            }
            
            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Pathfinding with obstacles exception: ${error.message}` };
        }
    }

    private async testMultiWaypointPath(): Promise<{ success: boolean; error: string }> {
        try {
            const waypoints = [
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 5, y: 5 },
                { x: 0, y: 5 }
            ];
            
            const result = this.engine.findMultiWaypointPath(waypoints);
            
            if (!result.success || result.path.length === 0) {
                return { success: false, error: `Multi-waypoint pathfinding failed: could not find path through waypoints` };
            }
            
            if (result.pathLength < waypoints.length - 1) {
                return { success: false, error: `Multi-waypoint path too short: expected at least ${waypoints.length - 1} steps, got ${result.pathLength}` };
            }
            
            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Multi-waypoint pathfinding exception: ${error.message}` };
        }
    }

    private async testNoPathScenario(): Promise<{ success: boolean; error: string }> {
        try {
            // Create a scenario with no possible path
            const testEngine = new PathfindingEngine(5, 5);
            
            // Block entire middle row
            for (let x = 0; x < 5; x++) {
                testEngine.addObstacle(x, 2);
            }
            
            const result = testEngine.findPath({ x: 0, y: 0 }, { x: 0, y: 4 });
            
            if (result.success) {
                return { success: false, error: `No path scenario failed: should not find path when completely blocked` };
            }
            
            if (result.path.length > 0) {
                return { success: false, error: `No path scenario failed: path should be empty when no route available` };
            }
            
            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `No path scenario exception: ${error.message}` };
        }
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const benchmark = new PathfindingBenchmark();
    
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
        process.exit(result.successRate < 10 ? 0 : 1);
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