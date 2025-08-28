#!/usr/bin/env bun

/**
 * Advanced Algorithms Test Suite - Comprehensive LLM Benchmarking
 * Tests complex algorithms with intentionally broken implementations
 * Provides spectrum of difficulty levels for evaluating LLM code fixing abilities
 */

import { BrokenAdvancedAlgorithms } from '../engines/broken-advanced-algorithms.js';
import { PureLibraryAlgorithms } from '../engines/pure-library-algorithms.js';

export interface TestResult {
    testName: string;
    passed: boolean;
    error?: string;
    executionTime: number;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert';
}

export interface BenchmarkResult {
    suiteName: string;
    passed: number;
    total: number;
    successRate: number;
    errors: string[];
    executionTime: number;
    details: TestResult[];
    difficultyBreakdown: {
        easy: { passed: number; total: number };
        medium: { passed: number; total: number };
        hard: { passed: number; total: number };
        expert: { passed: number; total: number };
    };
}

export class AdvancedAlgorithmsBenchmark {
    private engine: BrokenAdvancedAlgorithms | PureLibraryAlgorithms;

    constructor(customEngine?: BrokenAdvancedAlgorithms | PureLibraryAlgorithms) {
        this.engine = customEngine || new BrokenAdvancedAlgorithms();
    }

    async runBenchmark(): Promise<BenchmarkResult> {
        const startTime = performance.now();
        const tests: TestResult[] = [];
        let passed = 0;
        const errors: string[] = [];

        // Quick mode for faster testing
        const isQuickMode = process.env.QUICK_MODE === 'true';
        console.log('🚀 Starting Advanced Algorithms Test Suite');
        if (isQuickMode) {
            console.log('⚡ Quick Mode: Testing core advanced algorithms (30 total tests)');
        } else {
            console.log('📊 Full Mode: Testing all advanced algorithms (75 total tests)');
        }

        // Define all test methods with difficulty levels
        const testMethods = [
            // EASY LEVEL - Basic algorithm bugs (15 tests)
            { name: 'Binary Search Basic', method: () => this.testBinarySearchBasic(), difficulty: 'Easy' as const },
            { name: 'Binary Search Edge Cases', method: () => this.testBinarySearchEdgeCases(), difficulty: 'Easy' as const },
            { name: 'Binary Search Single Element', method: () => this.testBinarySearchSingleElement(), difficulty: 'Easy' as const },
            { name: 'Binary Search Not Found', method: () => this.testBinarySearchNotFound(), difficulty: 'Easy' as const },
            { name: 'Merge Sort Small Array', method: () => this.testMergeSortSmall(), difficulty: 'Easy' as const },
            { name: 'Merge Sort Empty Array', method: () => this.testMergeSortEmpty(), difficulty: 'Easy' as const },
            { name: 'Merge Sort Large Array', method: () => this.testMergeSortLarge(), difficulty: 'Easy' as const },
            { name: 'Merge Sort Duplicates', method: () => this.testMergeSortDuplicates(), difficulty: 'Easy' as const },
            { name: 'Quick Sort Basic', method: () => this.testQuickSortBasic(), difficulty: 'Easy' as const },
            { name: 'Quick Sort Reverse Sorted', method: () => this.testQuickSortReverse(), difficulty: 'Easy' as const },
            { name: 'Quick Sort All Same', method: () => this.testQuickSortAllSame(), difficulty: 'Easy' as const },
            { name: 'Quick Sort Large Random', method: () => this.testQuickSortLargeRandom(), difficulty: 'Easy' as const },
            { name: 'Quick Sort Edge Cases', method: () => this.testQuickSortEdgeCases(), difficulty: 'Easy' as const },
            { name: 'Dijkstra Basic Path', method: () => this.testDijkstraBasicPath(), difficulty: 'Easy' as const },
            { name: 'Dijkstra No Path', method: () => this.testDijkstraNoPath(), difficulty: 'Easy' as const },
            
            // MEDIUM LEVEL - Data structure algorithms (20 tests)
            { name: 'Trie Insert and Search', method: () => this.testTrieBasic(), difficulty: 'Medium' as const },
            { name: 'Trie Prefix Suggestions', method: () => this.testTriePrefixSuggestions(), difficulty: 'Medium' as const },
            { name: 'Trie Complex Words', method: () => this.testTrieComplexWords(), difficulty: 'Medium' as const },
            { name: 'Trie Empty and Single Char', method: () => this.testTrieEdgeCases(), difficulty: 'Medium' as const },
            { name: 'Trie Large Dictionary', method: () => this.testTrieLargeDictionary(), difficulty: 'Medium' as const },
            { name: 'Union Find Basic Operations', method: () => this.testUnionFindBasic(), difficulty: 'Medium' as const },
            { name: 'Union Find Path Compression', method: () => this.testUnionFindPathCompression(), difficulty: 'Medium' as const },
            { name: 'Union Find Connected Components', method: () => this.testUnionFindConnectedComponents(), difficulty: 'Medium' as const },
            { name: 'Union Find Performance Test', method: () => this.testUnionFindPerformance(), difficulty: 'Medium' as const },
            { name: 'LRU Cache Basic Operations', method: () => this.testLRUCacheBasic(), difficulty: 'Medium' as const },
            { name: 'LRU Cache Capacity Management', method: () => this.testLRUCacheCapacity(), difficulty: 'Medium' as const },
            { name: 'LRU Cache Update Existing', method: () => this.testLRUCacheUpdateExisting(), difficulty: 'Medium' as const },
            { name: 'LRU Cache Large Capacity', method: () => this.testLRUCacheLargeCapacity(), difficulty: 'Medium' as const },
            { name: 'LRU Cache Single Capacity', method: () => this.testLRUCacheSingleCapacity(), difficulty: 'Medium' as const },
            { name: 'Dijkstra Simple Graph', method: () => this.testDijkstraSimple(), difficulty: 'Medium' as const },
            { name: 'Dijkstra Complex Graph', method: () => this.testDijkstraComplex(), difficulty: 'Medium' as const },
            { name: 'Dijkstra Self Loop', method: () => this.testDijkstraSelfLoop(), difficulty: 'Medium' as const },
            { name: 'Dijkstra Negative Weights', method: () => this.testDijkstraNegativeWeights(), difficulty: 'Medium' as const },
            { name: 'Dijkstra Dense Graph', method: () => this.testDijkstraDenseGraph(), difficulty: 'Medium' as const },
            { name: 'Dijkstra Sparse Graph', method: () => this.testDijkstraSparseGraph(), difficulty: 'Medium' as const },
            
            // HARD LEVEL - Advanced algorithms (25 tests)
            { name: 'Segment Tree Build', method: () => this.testSegmentTreeBuild(), difficulty: 'Hard' as const },
            { name: 'Segment Tree Range Query', method: () => this.testSegmentTreeQuery(), difficulty: 'Hard' as const },
            { name: 'Segment Tree Min Max Query', method: () => this.testSegmentTreeMinMax(), difficulty: 'Hard' as const },
            { name: 'Segment Tree Single Element', method: () => this.testSegmentTreeSingleElement(), difficulty: 'Hard' as const },
            { name: 'Segment Tree Large Array', method: () => this.testSegmentTreeLargeArray(), difficulty: 'Hard' as const },
            { name: 'Segment Tree Edge Ranges', method: () => this.testSegmentTreeEdgeRanges(), difficulty: 'Hard' as const },
            { name: 'Topological Sort DAG', method: () => this.testTopologicalSortDAG(), difficulty: 'Hard' as const },
            { name: 'Topological Sort Cycle Detection', method: () => this.testTopologicalSortCycle(), difficulty: 'Hard' as const },
            { name: 'Topological Sort Complex DAG', method: () => this.testTopologicalSortComplexDAG(), difficulty: 'Hard' as const },
            { name: 'Topological Sort Single Node', method: () => this.testTopologicalSortSingleNode(), difficulty: 'Hard' as const },
            { name: 'Topological Sort Disconnected', method: () => this.testTopologicalSortDisconnected(), difficulty: 'Hard' as const },
            { name: 'Convex Hull Simple', method: () => this.testConvexHullSimple(), difficulty: 'Hard' as const },
            { name: 'Convex Hull Complex', method: () => this.testConvexHullComplex(), difficulty: 'Hard' as const },
            { name: 'Convex Hull Collinear Points', method: () => this.testConvexHullCollinear(), difficulty: 'Hard' as const },
            { name: 'Convex Hull Square', method: () => this.testConvexHullSquare(), difficulty: 'Hard' as const },
            { name: 'Convex Hull Large Set', method: () => this.testConvexHullLargeSet(), difficulty: 'Hard' as const },
            { name: 'KMP Pattern Matching', method: () => this.testKMPBasic(), difficulty: 'Hard' as const },
            { name: 'KMP Failure Function', method: () => this.testKMPFailureFunction(), difficulty: 'Hard' as const },
            { name: 'KMP Multiple Matches', method: () => this.testKMPMultipleMatches(), difficulty: 'Hard' as const },
            { name: 'KMP Overlapping Patterns', method: () => this.testKMPOverlappingPatterns(), difficulty: 'Hard' as const },
            { name: 'KMP Long Pattern', method: () => this.testKMPLongPattern(), difficulty: 'Hard' as const },
            { name: 'KMP Repeating Pattern', method: () => this.testKMPRepeatingPattern(), difficulty: 'Hard' as const },
            { name: 'KMP No Match', method: () => this.testKMPNoMatch(), difficulty: 'Hard' as const },
            { name: 'KMP Single Character', method: () => this.testKMPSingleCharacter(), difficulty: 'Hard' as const },
            { name: 'KMP Pattern Length Edge Cases', method: () => this.testKMPPatternLengthEdges(), difficulty: 'Hard' as const },
            
            // EXPERT LEVEL - Very advanced algorithms (15 tests)
            { name: 'Suffix Array Construction', method: () => this.testSuffixArrayConstruction(), difficulty: 'Expert' as const },
            { name: 'Suffix Array LCP Array', method: () => this.testSuffixArrayLCP(), difficulty: 'Expert' as const },
            { name: 'Suffix Array Longest Repeated', method: () => this.testSuffixArrayLongestRepeated(), difficulty: 'Expert' as const },
            { name: 'Suffix Array Complex String', method: () => this.testSuffixArrayComplexString(), difficulty: 'Expert' as const },
            { name: 'Suffix Array Palindromes', method: () => this.testSuffixArrayPalindromes(), difficulty: 'Expert' as const },
            { name: 'Max Flow Basic', method: () => this.testMaxFlowBasic(), difficulty: 'Expert' as const },
            { name: 'Max Flow Complex Network', method: () => this.testMaxFlowComplex(), difficulty: 'Expert' as const },
            { name: 'Max Flow Min Cut', method: () => this.testMaxFlowMinCut(), difficulty: 'Expert' as const },
            { name: 'Max Flow Bottleneck Network', method: () => this.testMaxFlowBottleneck(), difficulty: 'Expert' as const },
            { name: 'Max Flow Large Network', method: () => this.testMaxFlowLargeNetwork(), difficulty: 'Expert' as const },
            { name: 'Bloom Filter Basic', method: () => this.testBloomFilterBasic(), difficulty: 'Expert' as const },
            { name: 'Bloom Filter False Positive', method: () => this.testBloomFilterFalsePositive(), difficulty: 'Expert' as const },
            { name: 'Bloom Filter Capacity', method: () => this.testBloomFilterCapacity(), difficulty: 'Expert' as const },
            { name: 'Bloom Filter High Load', method: () => this.testBloomFilterHighLoad(), difficulty: 'Expert' as const },
            { name: 'Bloom Filter Error Rate Validation', method: () => this.testBloomFilterErrorRate(), difficulty: 'Expert' as const }
        ];

        // In quick mode, run a subset of tests across all difficulty levels
        const testsToRun = isQuickMode ? [
            ...testMethods.filter(t => t.difficulty === 'Easy').slice(0, 5),
            ...testMethods.filter(t => t.difficulty === 'Medium').slice(0, 8),
            ...testMethods.filter(t => t.difficulty === 'Hard').slice(0, 10),
            ...testMethods.filter(t => t.difficulty === 'Expert').slice(0, 7)
        ] : testMethods;

        let testCount = 1;
        for (const testMethod of testsToRun) {
            console.log(`🧪 Test ${testCount}/${testsToRun.length}: ${testMethod.name} [${testMethod.difficulty}]`);
            
            const testStart = performance.now();
            try {
                const result = await Promise.race([
                    testMethod.method(),
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Test timed out')), 10000);
                    })
                ]);

                const testResult = result as { success: boolean; error: string };
                if (testResult.success) {
                    passed++;
                    tests.push({
                        testName: testMethod.name,
                        passed: true,
                        executionTime: performance.now() - testStart,
                        difficulty: testMethod.difficulty
                    });
                    console.log(`   ✅ PASSED`);
                } else {
                    const error = testResult.error;
                    errors.push(`${testMethod.name}: ${error}`);
                    tests.push({
                        testName: testMethod.name,
                        passed: false,
                        error,
                        executionTime: performance.now() - testStart,
                        difficulty: testMethod.difficulty
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
                    executionTime: performance.now() - testStart,
                    difficulty: testMethod.difficulty
                });
                console.log(`   ❌ FAILED: ${errorMsg}`);
            }
            testCount++;
        }

        const executionTime = performance.now() - startTime;
        const totalTests = testsToRun.length;
        const successRate = (passed / totalTests) * 100;

        // Calculate difficulty breakdown
        const difficultyBreakdown = {
            easy: { passed: 0, total: 0 },
            medium: { passed: 0, total: 0 },
            hard: { passed: 0, total: 0 },
            expert: { passed: 0, total: 0 }
        };

        for (const test of tests) {
            const level = test.difficulty.toLowerCase() as keyof typeof difficultyBreakdown;
            difficultyBreakdown[level].total++;
            if (test.passed) {
                difficultyBreakdown[level].passed++;
            }
        }

        console.log('\\n📊 ADVANCED ALGORITHMS BENCHMARK RESULTS');
        console.log('=' .repeat(60));
        console.log(`📈 Tests Passed: ${passed}/${totalTests} (${successRate.toFixed(1)}%)`);
        console.log(`⏱️  Total Execution Time: ${executionTime.toFixed(2)}ms`);
        
        console.log('\\n📊 Difficulty Breakdown:');
        console.log(`   🟢 Easy: ${difficultyBreakdown.easy.passed}/${difficultyBreakdown.easy.total} (${((difficultyBreakdown.easy.passed/difficultyBreakdown.easy.total)*100).toFixed(1)}%)`);
        console.log(`   🟡 Medium: ${difficultyBreakdown.medium.passed}/${difficultyBreakdown.medium.total} (${((difficultyBreakdown.medium.passed/difficultyBreakdown.medium.total)*100).toFixed(1)}%)`);
        console.log(`   🟠 Hard: ${difficultyBreakdown.hard.passed}/${difficultyBreakdown.hard.total} (${((difficultyBreakdown.hard.passed/difficultyBreakdown.hard.total)*100).toFixed(1)}%)`);
        console.log(`   🔴 Expert: ${difficultyBreakdown.expert.passed}/${difficultyBreakdown.expert.total} (${((difficultyBreakdown.expert.passed/difficultyBreakdown.expert.total)*100).toFixed(1)}%)`);

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
            suiteName: 'Advanced Algorithms',
            passed,
            total: totalTests,
            successRate,
            errors,
            executionTime,
            details: tests,
            difficultyBreakdown
        };
    }

    // EASY LEVEL TESTS
    private async testBinarySearchBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [1, 3, 5, 7, 9, 11, 13];
            const result = this.engine.binarySearch(arr, 7);
            
            if (result !== 3) {
                return { success: false, error: `Binary search failed: expected index 3 for value 7, got ${result}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Binary search exception: ${error.message}` };
        }
    }

    private async testBinarySearchEdgeCases(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [1, 2, 3, 4, 5];
            
            // Test first element
            const first = this.engine.binarySearch(arr, 1);
            if (first !== 0) {
                return { success: false, error: `Binary search first element failed: expected 0, got ${first}` };
            }
            
            // Test last element
            const last = this.engine.binarySearch(arr, 5);
            if (last !== 4) {
                return { success: false, error: `Binary search last element failed: expected 4, got ${last}` };
            }
            
            // Test middle element
            const middle = this.engine.binarySearch(arr, 3);
            if (middle !== 2) {
                return { success: false, error: `Binary search middle element failed: expected 2, got ${middle}` };
            }
            
            // Test not found - below range
            const belowRange = this.engine.binarySearch(arr, 0);
            if (belowRange !== -1) {
                return { success: false, error: `Binary search below range failed: expected -1, got ${belowRange}` };
            }
            
            // Test not found - above range
            const aboveRange = this.engine.binarySearch(arr, 6);
            if (aboveRange !== -1) {
                return { success: false, error: `Binary search above range failed: expected -1, got ${aboveRange}` };
            }
            
            // Test not found - between elements
            const between = this.engine.binarySearch([1, 3, 5, 7], 4);
            if (between !== -1) {
                return { success: false, error: `Binary search between elements failed: expected -1, got ${between}` };
            }
            
            // Test with duplicates - should return any valid index
            const withDups = [1, 2, 2, 2, 3];
            const dupResult = this.engine.binarySearch(withDups, 2);
            if (dupResult < 1 || dupResult > 3) {
                return { success: false, error: `Binary search with duplicates failed: expected index 1-3, got ${dupResult}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Binary search edge cases exception: ${error.message}` };
        }
    }

    private async testMergeSortSmall(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [3, 1, 4, 1, 5, 9, 2, 6];
            const originalArr = [...arr];
            const sorted = this.engine.mergeSort([...arr]);
            const expected = [1, 1, 2, 3, 4, 5, 6, 9];
            
            // Check if sorted correctly
            if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
                return { success: false, error: `Merge sort failed: expected [${expected}], got [${sorted}]` };
            }
            
            // Check if original array length is preserved
            if (sorted.length !== originalArr.length) {
                return { success: false, error: `Merge sort length mismatch: expected ${originalArr.length}, got ${sorted.length}` };
            }
            
            // Check if all elements are preserved (frequency count)
            const originalFreq = new Map<number, number>();
            const sortedFreq = new Map<number, number>();
            
            for (const num of originalArr) {
                originalFreq.set(num, (originalFreq.get(num) || 0) + 1);
            }
            for (const num of sorted) {
                sortedFreq.set(num, (sortedFreq.get(num) || 0) + 1);
            }
            
            for (const [num, count] of originalFreq) {
                if (sortedFreq.get(num) !== count) {
                    return { success: false, error: `Merge sort element frequency mismatch: ${num} appears ${count} times in original, ${sortedFreq.get(num) || 0} times in sorted` };
                }
            }
            
            // Check if actually sorted
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] < sorted[i-1]) {
                    return { success: false, error: `Merge sort not properly sorted: element at index ${i} (${sorted[i]}) < element at index ${i-1} (${sorted[i-1]})` };
                }
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Merge sort exception: ${error.message}` };
        }
    }

    private async testMergeSortEmpty(): Promise<{ success: boolean; error: string }> {
        try {
            const empty = this.engine.mergeSort([]);
            if (empty.length !== 0) {
                return { success: false, error: `Merge sort empty array failed: expected [], got [${empty}]` };
            }
            
            const single = this.engine.mergeSort([42]);
            if (single.length !== 1 || single[0] !== 42) {
                return { success: false, error: `Merge sort single element failed: expected [42], got [${single}]` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Merge sort empty/single exception: ${error.message}` };
        }
    }

    private async testQuickSortBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [64, 34, 25, 12, 22, 11, 90];
            const sorted = this.engine.quickSort([...arr]);
            const expected = [11, 12, 22, 25, 34, 64, 90];
            
            if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
                return { success: false, error: `Quick sort failed: expected [${expected}], got [${sorted}]` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Quick sort exception: ${error.message}` };
        }
    }

    // MEDIUM LEVEL TESTS
    private async testTrieBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const root = { children: {}, isEndOfWord: false };
            
            this.engine.insertTrie(root, 'hello');
            this.engine.insertTrie(root, 'world');
            this.engine.insertTrie(root, 'help');
            
            const result1 = this.engine.searchTrie(root, 'hello');
            if (!result1.found) {
                return { success: false, error: `Trie search failed: 'hello' should be found` };
            }
            
            const result2 = this.engine.searchTrie(root, 'hell');
            if (result2.found) {
                return { success: false, error: `Trie search failed: 'hell' should not be found as complete word` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Trie basic exception: ${error.message}` };
        }
    }

    private async testTriePrefixSuggestions(): Promise<{ success: boolean; error: string }> {
        try {
            const root = { children: {}, isEndOfWord: false };
            
            const words = ['cat', 'car', 'card', 'care', 'careful', 'cars'];
            for (const word of words) {
                this.engine.insertTrie(root, word);
            }
            
            const result = this.engine.searchTrie(root, 'car');
            if (result.suggestions.length === 0) {
                return { success: false, error: `Trie suggestions failed: should find suggestions for 'car'` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Trie suggestions exception: ${error.message}` };
        }
    }

    private async testUnionFindBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const uf = this.engine.createUnionFind(5);
            
            // Initially all separate
            if (uf.components !== 5) {
                return { success: false, error: `Union find init failed: expected 5 components, got ${uf.components}` };
            }
            
            // Union 0 and 1
            const result1 = this.engine.union(uf, 0, 1);
            if (uf.components !== 4) {
                return { success: false, error: `Union find union failed: expected 4 components after union, got ${uf.components}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Union find basic exception: ${error.message}` };
        }
    }

    private async testUnionFindPathCompression(): Promise<{ success: boolean; error: string }> {
        try {
            const uf = this.engine.createUnionFind(6);
            
            // Create a chain: 0-1-2-3-4-5
            this.engine.union(uf, 0, 1);
            this.engine.union(uf, 1, 2);
            this.engine.union(uf, 2, 3);
            this.engine.union(uf, 3, 4);
            
            // Find should work correctly
            const root0 = this.engine.find(uf, 0);
            const root4 = this.engine.find(uf, 4);
            
            if (root0 !== root4) {
                return { success: false, error: `Union find path compression failed: 0 and 4 should have same root` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Union find path compression exception: ${error.message}` };
        }
    }

    private async testLRUCacheBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const cache = this.engine.createLRUCache(2);
            
            this.engine.lruPut(cache, 'key1', 'value1');
            this.engine.lruPut(cache, 'key2', 'value2');
            
            const result1 = this.engine.lruGet(cache, 'key1');
            if (!result1.wasHit || result1.value !== 'value1') {
                return { success: false, error: `LRU cache get failed: expected hit with 'value1', got ${result1}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `LRU cache basic exception: ${error.message}` };
        }
    }

    private async testLRUCacheCapacity(): Promise<{ success: boolean; error: string }> {
        try {
            const cache = this.engine.createLRUCache(2);
            
            this.engine.lruPut(cache, 'key1', 'value1');
            this.engine.lruPut(cache, 'key2', 'value2');
            this.engine.lruPut(cache, 'key3', 'value3'); // Should evict key1
            
            const result1 = this.engine.lruGet(cache, 'key1');
            if (result1.wasHit) {
                return { success: false, error: `LRU cache capacity failed: key1 should be evicted` };
            }
            
            const result3 = this.engine.lruGet(cache, 'key3');
            if (!result3.wasHit) {
                return { success: false, error: `LRU cache capacity failed: key3 should be present` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `LRU cache capacity exception: ${error.message}` };
        }
    }

    private async testDijkstraSimple(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', [{ node: 'B', weight: 1 }, { node: 'C', weight: 4 }]);
            graph.set('B', [{ node: 'C', weight: 2 }, { node: 'D', weight: 5 }]);
            graph.set('C', [{ node: 'D', weight: 1 }]);
            graph.set('D', []);
            
            const distances = this.engine.dijkstra(graph, 'A');
            
            if (distances.get('D') !== 4) { // A->B->C->D = 1+2+1 = 4
                return { success: false, error: `Dijkstra failed: expected distance to D = 4, got ${distances.get('D')}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra simple exception: ${error.message}` };
        }
    }

    private async testDijkstraComplex(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('S', [{ node: 'A', weight: 10 }, { node: 'B', weight: 5 }]);
            graph.set('A', [{ node: 'B', weight: 2 }, { node: 'C', weight: 1 }]);
            graph.set('B', [{ node: 'C', weight: 9 }, { node: 'D', weight: 2 }]);
            graph.set('C', [{ node: 'D', weight: 4 }, { node: 'T', weight: 2 }]);
            graph.set('D', [{ node: 'T', weight: 7 }]);
            graph.set('T', []);
            
            const distances = this.engine.dijkstra(graph, 'S');
            
            // Shortest path S->B->D->T should be 5+2+7=14, but S->B->A->C->T = 5+2+1+2=10
            if (distances.get('T') !== 10) {
                return { success: false, error: `Dijkstra complex failed: expected distance to T = 10, got ${distances.get('T')}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra complex exception: ${error.message}` };
        }
    }

    // HARD LEVEL TESTS
    private async testSegmentTreeBuild(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [1, 3, 5, 7, 9, 11];
            const tree = this.engine.buildSegmentTree(arr);
            
            if (tree.length === 0) {
                return { success: false, error: `Segment tree build failed: tree is empty` };
            }
            
            // Tree should have been built without throwing errors
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Segment tree build exception: ${error.message}` };
        }
    }

    private async testSegmentTreeQuery(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [1, 3, 5, 7, 9, 11];
            const tree = this.engine.buildSegmentTree(arr);
            
            const result = this.engine.querySegmentTree(tree, 1, 0, arr.length - 1, 1, 3);
            
            // Query sum from index 1 to 3: arr[1] + arr[2] + arr[3] = 3 + 5 + 7 = 15
            if (result.sum !== 15) {
                return { success: false, error: `Segment tree query failed: expected sum 15, got ${result.sum}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Segment tree query exception: ${error.message}` };
        }
    }

    private async testSegmentTreeMinMax(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [2, 8, 1, 6, 4];
            const tree = this.engine.buildSegmentTree(arr);
            
            const result = this.engine.querySegmentTree(tree, 1, 0, arr.length - 1, 1, 3);
            
            // Query range [1, 3]: elements are [8, 1, 6]
            // Min should be 1, Max should be 8
            if (result.min !== 1 || result.max !== 8) {
                return { success: false, error: `Segment tree min/max failed: expected min=1, max=8, got min=${result.min}, max=${result.max}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Segment tree min/max exception: ${error.message}` };
        }
    }

    private async testTopologicalSortDAG(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', ['B', 'C']);
            graph.set('B', ['D']);
            graph.set('C', ['D']);
            graph.set('D', []);
            
            const result = this.engine.topologicalSort(graph);
            
            if (result.hasCycle) {
                return { success: false, error: `Topological sort DAG failed: should not detect cycle in DAG` };
            }
            
            if (result.order.length !== 4) {
                return { success: false, error: `Topological sort DAG failed: expected 4 nodes in order, got ${result.order.length}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Topological sort DAG exception: ${error.message}` };
        }
    }

    private async testTopologicalSortCycle(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', ['B']);
            graph.set('B', ['C']);
            graph.set('C', ['A']); // Creates a cycle
            
            const result = this.engine.topologicalSort(graph);
            
            if (!result.hasCycle) {
                return { success: false, error: `Topological sort cycle failed: should detect cycle` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Topological sort cycle exception: ${error.message}` };
        }
    }

    private async testConvexHullSimple(): Promise<{ success: boolean; error: string }> {
        try {
            const points = [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 0 },
                { x: 1, y: -1 }
            ];
            
            const result = this.engine.convexHull(points);
            
            if (result.hull.length < 3) {
                return { success: false, error: `Convex hull failed: hull should have at least 3 points, got ${result.hull.length}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Convex hull simple exception: ${error.message}` };
        }
    }

    private async testConvexHullComplex(): Promise<{ success: boolean; error: string }> {
        try {
            const points = [
                { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 },
                { x: 3, y: 1 }, { x: 4, y: 0 }, { x: 3, y: -1 },
                { x: 2, y: -2 }, { x: 1, y: -1 }, { x: 1.5, y: 0.5 }
            ];
            
            const result = this.engine.convexHull(points);
            
            if (result.area <= 0) {
                return { success: false, error: `Convex hull area failed: area should be positive, got ${result.area}` };
            }
            
            if (result.perimeter <= 0) {
                return { success: false, error: `Convex hull perimeter failed: perimeter should be positive, got ${result.perimeter}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Convex hull complex exception: ${error.message}` };
        }
    }

    private async testKMPBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'ABABDABACDABABCABCABCABCABC';
            const pattern = 'ABABCABCABCABC';
            
            const result = this.engine.kmpSearch(text, pattern);
            
            if (result.matches.length === 0) {
                return { success: false, error: `KMP search failed: should find pattern in text` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP basic exception: ${error.message}` };
        }
    }

    private async testKMPFailureFunction(): Promise<{ success: boolean; error: string }> {
        try {
            const pattern = 'ABABACA';
            const result = this.engine.kmpSearch('', pattern);
            
            // The failure function should be computed correctly
            if (result.patternTable.length !== pattern.length) {
                return { success: false, error: `KMP failure function failed: table length should be ${pattern.length}, got ${result.patternTable.length}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP failure function exception: ${error.message}` };
        }
    }

    private async testKMPMultipleMatches(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'AAAAAAAAAA';
            const pattern = 'AAA';
            
            const result = this.engine.kmpSearch(text, pattern);
            
            // Should find multiple overlapping matches
            if (result.matches.length < 8) {
                return { success: false, error: `KMP multiple matches failed: should find 8 matches, got ${result.matches.length}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP multiple matches exception: ${error.message}` };
        }
    }

    // EXPERT LEVEL TESTS
    private async testSuffixArrayConstruction(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'banana';
            const result = this.engine.buildSuffixArray(text);
            
            if (result.suffixArray.length !== text.length) {
                return { success: false, error: `Suffix array construction failed: array length should be ${text.length}, got ${result.suffixArray.length}` };
            }
            
            // Check if all indices are present
            const indices = new Set(result.suffixArray);
            if (indices.size !== text.length) {
                return { success: false, error: `Suffix array construction failed: should contain all unique indices` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Suffix array construction exception: ${error.message}` };
        }
    }

    private async testSuffixArrayLCP(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'abcab';
            const result = this.engine.buildSuffixArray(text);
            
            if (result.lcp.length !== text.length) {
                return { success: false, error: `Suffix array LCP failed: LCP array length should be ${text.length}, got ${result.lcp.length}` };
            }
            
            // LCP[0] should always be 0
            if (result.lcp[0] !== 0) {
                return { success: false, error: `Suffix array LCP failed: LCP[0] should be 0, got ${result.lcp[0]}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Suffix array LCP exception: ${error.message}` };
        }
    }

    private async testSuffixArrayLongestRepeated(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'abcabcabc';
            const result = this.engine.buildSuffixArray(text);
            
            // Should find repeated substring
            if (result.longestRepeatedSubstring.length === 0) {
                return { success: false, error: `Suffix array longest repeated failed: should find repeated substring` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Suffix array longest repeated exception: ${error.message}` };
        }
    }

    private async testMaxFlowBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('S', new Map([['A', 10], ['B', 10]]));
            graph.set('A', new Map([['B', 2], ['T', 10]]));
            graph.set('B', new Map([['T', 10]]));
            graph.set('T', new Map());
            
            const result = this.engine.maxFlow(graph, 'S', 'T');
            
            if (result.maxFlow <= 0) {
                return { success: false, error: `Max flow basic failed: flow should be positive, got ${result.maxFlow}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Max flow basic exception: ${error.message}` };
        }
    }

    private async testMaxFlowComplex(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('S', new Map([['A', 16], ['C', 13]]));
            graph.set('A', new Map([['B', 10], ['C', 4]]));
            graph.set('B', new Map([['C', 9], ['T', 14]]));
            graph.set('C', new Map([['B', 4], ['D', 14]]));
            graph.set('D', new Map([['T', 4]]));
            graph.set('T', new Map());
            
            const result = this.engine.maxFlow(graph, 'S', 'T');
            
            // For this network, max flow should be 18
            if (result.maxFlow !== 18) {
                return { success: false, error: `Max flow complex failed: expected flow 18, got ${result.maxFlow}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Max flow complex exception: ${error.message}` };
        }
    }

    private async testMaxFlowMinCut(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('S', new Map([['A', 3], ['B', 3]]));
            graph.set('A', new Map([['T', 2]]));
            graph.set('B', new Map([['T', 2]]));
            graph.set('T', new Map());
            
            const result = this.engine.maxFlow(graph, 'S', 'T');
            
            if (result.minCut.length === 0) {
                return { success: false, error: `Max flow min cut failed: should find min cut edges` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Max flow min cut exception: ${error.message}` };
        }
    }

    private async testBloomFilterBasic(): Promise<{ success: boolean; error: string }> {
        try {
            const filter = this.engine.createBloomFilter(1000, 0.01);
            
            this.engine.bloomAdd(filter, 'hello');
            this.engine.bloomAdd(filter, 'world');
            
            const result1 = this.engine.bloomContains(filter, 'hello');
            if (!result1.mightContain) {
                return { success: false, error: `Bloom filter basic failed: 'hello' should be contained` };
            }
            
            const result2 = this.engine.bloomContains(filter, 'nonexistent');
            if (result2.mightContain) {
                return { success: false, error: `Bloom filter basic failed: 'nonexistent' should not be contained` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Bloom filter basic exception: ${error.message}` };
        }
    }

    private async testBloomFilterFalsePositive(): Promise<{ success: boolean; error: string }> {
        try {
            const filter = this.engine.createBloomFilter(100, 0.1);
            
            // Add many items to increase false positive probability
            for (let i = 0; i < 50; i++) {
                this.engine.bloomAdd(filter, `item${i}`);
            }
            
            const result = this.engine.bloomContains(filter, 'item0');
            if (result.falsePositiveRate <= 0 || result.falsePositiveRate >= 1) {
                return { success: false, error: `Bloom filter false positive rate failed: rate should be between 0 and 1, got ${result.falsePositiveRate}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Bloom filter false positive exception: ${error.message}` };
        }
    }

    private async testBloomFilterCapacity(): Promise<{ success: boolean; error: string }> {
        try {
            const filter = this.engine.createBloomFilter(10, 0.01);
            
            for (let i = 0; i < 15; i++) {
                this.engine.bloomAdd(filter, `item${i}`);
            }
            
            if (filter.itemCount <= 0) {
                return { success: false, error: `Bloom filter capacity failed: item count should be positive, got ${filter.itemCount}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Bloom filter capacity exception: ${error.message}` };
        }
    }

    // NEW EASY LEVEL TESTS
    private async testBinarySearchSingleElement(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [42];
            const found = this.engine.binarySearch(arr, 42);
            const notFound = this.engine.binarySearch(arr, 1);
            
            if (found !== 0) {
                return { success: false, error: `Binary search single element failed: expected 0, got ${found}` };
            }
            if (notFound !== -1) {
                return { success: false, error: `Binary search single element not found failed: expected -1, got ${notFound}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Binary search single element exception: ${error.message}` };
        }
    }

    private async testBinarySearchNotFound(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [1, 3, 5, 7, 9];
            const tests = [0, 2, 4, 6, 8, 10];
            
            for (const target of tests) {
                const result = this.engine.binarySearch(arr, target);
                if (result !== -1) {
                    return { success: false, error: `Binary search not found failed for ${target}: expected -1, got ${result}` };
                }
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Binary search not found exception: ${error.message}` };
        }
    }

    private async testMergeSortLarge(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = Array.from({ length: 100 }, () => Math.floor(Math.random() * 1000));
            const sorted = this.engine.mergeSort([...arr]);
            const expected = [...arr].sort((a, b) => a - b);
            
            if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
                return { success: false, error: `Merge sort large array failed: sorting incorrect` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Merge sort large array exception: ${error.message}` };
        }
    }

    private async testMergeSortDuplicates(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [5, 2, 8, 2, 1, 5, 5, 3];
            const sorted = this.engine.mergeSort([...arr]);
            const expected = [1, 2, 2, 3, 5, 5, 5, 8];
            
            if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
                return { success: false, error: `Merge sort duplicates failed: expected [${expected}], got [${sorted}]` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Merge sort duplicates exception: ${error.message}` };
        }
    }

    private async testQuickSortReverse(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [9, 8, 7, 6, 5, 4, 3, 2, 1];
            const sorted = this.engine.quickSort([...arr]);
            const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            
            if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
                return { success: false, error: `Quick sort reverse failed: expected [${expected}], got [${sorted}]` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Quick sort reverse exception: ${error.message}` };
        }
    }

    private async testQuickSortAllSame(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [5, 5, 5, 5, 5];
            const sorted = this.engine.quickSort([...arr]);
            const expected = [5, 5, 5, 5, 5];
            
            if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
                return { success: false, error: `Quick sort all same failed: expected [${expected}], got [${sorted}]` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Quick sort all same exception: ${error.message}` };
        }
    }

    private async testQuickSortLargeRandom(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = Array.from({ length: 50 }, () => Math.floor(Math.random() * 100));
            const sorted = this.engine.quickSort([...arr]);
            const expected = [...arr].sort((a, b) => a - b);
            
            if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
                return { success: false, error: `Quick sort large random failed: sorting incorrect` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Quick sort large random exception: ${error.message}` };
        }
    }

    private async testQuickSortEdgeCases(): Promise<{ success: boolean; error: string }> {
        try {
            const empty = this.engine.quickSort([]);
            if (empty.length !== 0) {
                return { success: false, error: `Quick sort empty failed: expected [], got [${empty}]` };
            }
            
            const single = this.engine.quickSort([42]);
            if (single.length !== 1 || single[0] !== 42) {
                return { success: false, error: `Quick sort single failed: expected [42], got [${single}]` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Quick sort edge cases exception: ${error.message}` };
        }
    }

    private async testDijkstraBasicPath(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', [{ node: 'B', weight: 2 }, { node: 'C', weight: 4 }]);
            graph.set('B', [{ node: 'D', weight: 3 }]);
            graph.set('C', [{ node: 'D', weight: 1 }]);
            graph.set('D', []);
            
            const distances = this.engine.dijkstra(graph, 'A');
            
            if (distances.get('D') !== 5) {
                return { success: false, error: `Dijkstra basic path failed: expected distance to D = 5, got ${distances.get('D')}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra basic path exception: ${error.message}` };
        }
    }

    private async testDijkstraNoPath(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', [{ node: 'B', weight: 1 }]);
            graph.set('B', []);
            graph.set('C', [{ node: 'D', weight: 1 }]);
            graph.set('D', []);
            
            const distances = this.engine.dijkstra(graph, 'A');
            
            if (distances.get('C') !== Infinity || distances.get('D') !== Infinity) {
                return { success: false, error: `Dijkstra no path failed: unreachable nodes should have infinite distance` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra no path exception: ${error.message}` };
        }
    }

    // NEW MEDIUM LEVEL TESTS
    private async testTrieComplexWords(): Promise<{ success: boolean; error: string }> {
        try {
            const root = { children: {}, isEndOfWord: false };
            const words = ['algorithm', 'algorithmic', 'data', 'database', 'structure', 'structures'];
            
            for (const word of words) {
                this.engine.insertTrie(root, word);
            }
            
            const result1 = this.engine.searchTrie(root, 'algorithm');
            const result2 = this.engine.searchTrie(root, 'data');
            
            if (!result1.found || !result2.found) {
                return { success: false, error: `Trie complex words failed: words should be found` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Trie complex words exception: ${error.message}` };
        }
    }

    private async testTrieEdgeCases(): Promise<{ success: boolean; error: string }> {
        try {
            const root = { children: {}, isEndOfWord: false };
            
            this.engine.insertTrie(root, 'a');
            this.engine.insertTrie(root, '');
            
            const result1 = this.engine.searchTrie(root, 'a');
            const result2 = this.engine.searchTrie(root, '');
            
            if (!result1.found) {
                return { success: false, error: `Trie edge cases failed: single character should be found` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Trie edge cases exception: ${error.message}` };
        }
    }

    private async testTrieLargeDictionary(): Promise<{ success: boolean; error: string }> {
        try {
            const root = { children: {}, isEndOfWord: false };
            const words: string[] = [];
            
            for (let i = 0; i < 100; i++) {
                words.push(`word${i}`);
            }
            
            for (const word of words) {
                this.engine.insertTrie(root, word);
            }
            
            const result = this.engine.searchTrie(root, 'word50');
            if (!result.found) {
                return { success: false, error: `Trie large dictionary failed: word50 should be found` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Trie large dictionary exception: ${error.message}` };
        }
    }

    private async testUnionFindConnectedComponents(): Promise<{ success: boolean; error: string }> {
        try {
            const uf = this.engine.createUnionFind(8);
            
            this.engine.union(uf, 0, 1);
            this.engine.union(uf, 2, 3);
            this.engine.union(uf, 4, 5);
            this.engine.union(uf, 1, 3);
            
            const root01 = this.engine.find(uf, 0);
            const root23 = this.engine.find(uf, 2);
            const root45 = this.engine.find(uf, 4);
            const root6 = this.engine.find(uf, 6);
            
            if (root01 !== root23) {
                return { success: false, error: `Union find connected components failed: 0-1 and 2-3 should be connected` };
            }
            
            if (root01 === root45 || root01 === root6) {
                return { success: false, error: `Union find connected components failed: components should be separate` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Union find connected components exception: ${error.message}` };
        }
    }

    private async testUnionFindPerformance(): Promise<{ success: boolean; error: string }> {
        try {
            const uf = this.engine.createUnionFind(1000);
            
            for (let i = 0; i < 500; i++) {
                this.engine.union(uf, i, i + 500);
            }
            
            const root0 = this.engine.find(uf, 0);
            const root999 = this.engine.find(uf, 999);
            
            if (root0 !== root999) {
                return { success: false, error: `Union find performance failed: 0 and 999 should be connected` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Union find performance exception: ${error.message}` };
        }
    }

    private async testLRUCacheUpdateExisting(): Promise<{ success: boolean; error: string }> {
        try {
            const cache = this.engine.createLRUCache(3);
            
            this.engine.lruPut(cache, 'key1', 'value1');
            this.engine.lruPut(cache, 'key2', 'value2');
            this.engine.lruPut(cache, 'key1', 'updated_value1');
            
            const result = this.engine.lruGet(cache, 'key1');
            if (!result.wasHit || result.value !== 'updated_value1') {
                return { success: false, error: `LRU cache update existing failed: expected updated value` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `LRU cache update existing exception: ${error.message}` };
        }
    }

    private async testLRUCacheLargeCapacity(): Promise<{ success: boolean; error: string }> {
        try {
            const cache = this.engine.createLRUCache(100);
            
            for (let i = 0; i < 50; i++) {
                this.engine.lruPut(cache, `key${i}`, `value${i}`);
            }
            
            const result = this.engine.lruGet(cache, 'key25');
            if (!result.wasHit || result.value !== 'value25') {
                return { success: false, error: `LRU cache large capacity failed: key25 should be present` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `LRU cache large capacity exception: ${error.message}` };
        }
    }

    private async testLRUCacheSingleCapacity(): Promise<{ success: boolean; error: string }> {
        try {
            const cache = this.engine.createLRUCache(1);
            
            this.engine.lruPut(cache, 'key1', 'value1');
            this.engine.lruPut(cache, 'key2', 'value2');
            
            const result1 = this.engine.lruGet(cache, 'key1');
            const result2 = this.engine.lruGet(cache, 'key2');
            
            if (result1.wasHit || !result2.wasHit) {
                return { success: false, error: `LRU cache single capacity failed: only key2 should be present` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `LRU cache single capacity exception: ${error.message}` };
        }
    }

    private async testDijkstraSelfLoop(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', [{ node: 'A', weight: 5 }, { node: 'B', weight: 2 }]);
            graph.set('B', [{ node: 'C', weight: 1 }]);
            graph.set('C', []);
            
            const distances = this.engine.dijkstra(graph, 'A');
            
            if (distances.get('A') !== 0 || distances.get('C') !== 3) {
                return { success: false, error: `Dijkstra self loop failed: incorrect distances` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra self loop exception: ${error.message}` };
        }
    }

    private async testDijkstraNegativeWeights(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', [{ node: 'B', weight: -1 }, { node: 'C', weight: 4 }]);
            graph.set('B', [{ node: 'C', weight: 3 }]);
            graph.set('C', []);
            
            const distances = this.engine.dijkstra(graph, 'A');
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra negative weights exception: ${error.message}` };
        }
    }

    private async testDijkstraDenseGraph(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map<string, { node: string; weight: number }[]>();
            const nodes: string[] = ['A', 'B', 'C', 'D', 'E'];
            
            for (const node of nodes) {
                const edges: { node: string; weight: number }[] = [];
                for (const other of nodes) {
                    if (node !== other) {
                        edges.push({ node: other, weight: Math.abs(node.charCodeAt(0) - other.charCodeAt(0)) });
                    }
                }
                graph.set(node, edges);
            }
            
            const distances = this.engine.dijkstra(graph, 'A');
            
            if (distances.get('E') === undefined || distances.get('E') === Infinity) {
                return { success: false, error: `Dijkstra dense graph failed: all nodes should be reachable` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra dense graph exception: ${error.message}` };
        }
    }

    private async testDijkstraSparseGraph(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', [{ node: 'B', weight: 10 }]);
            graph.set('B', [{ node: 'C', weight: 10 }]);
            graph.set('C', [{ node: 'D', weight: 10 }]);
            graph.set('D', []);
            graph.set('E', []);
            
            const distances = this.engine.dijkstra(graph, 'A');
            
            if (distances.get('D') !== 30 || distances.get('E') !== Infinity) {
                return { success: false, error: `Dijkstra sparse graph failed: incorrect distances` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Dijkstra sparse graph exception: ${error.message}` };
        }
    }

    // NEW HARD LEVEL TESTS
    private async testSegmentTreeSingleElement(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [42];
            const tree = this.engine.buildSegmentTree(arr);
            const result = this.engine.querySegmentTree(tree, 1, 0, 0, 0, 0);
            
            if (result.sum !== 42 || result.min !== 42 || result.max !== 42) {
                return { success: false, error: `Segment tree single element failed: expected sum=42, min=42, max=42` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Segment tree single element exception: ${error.message}` };
        }
    }

    private async testSegmentTreeLargeArray(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = Array.from({ length: 1000 }, (_, i) => i + 1);
            const tree = this.engine.buildSegmentTree(arr);
            const result = this.engine.querySegmentTree(tree, 1, 0, arr.length - 1, 100, 200);
            
            const expectedSum = (200 - 100 + 1) * (100 + 1 + 200 + 1) / 2;
            if (result.sum !== expectedSum) {
                return { success: false, error: `Segment tree large array failed: incorrect sum calculation` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Segment tree large array exception: ${error.message}` };
        }
    }

    private async testSegmentTreeEdgeRanges(): Promise<{ success: boolean; error: string }> {
        try {
            const arr = [1, 2, 3, 4, 5];
            const tree = this.engine.buildSegmentTree(arr);
            
            const result1 = this.engine.querySegmentTree(tree, 1, 0, arr.length - 1, 0, 0);
            const result2 = this.engine.querySegmentTree(tree, 1, 0, arr.length - 1, 4, 4);
            
            if (result1.sum !== 1 || result2.sum !== 5) {
                return { success: false, error: `Segment tree edge ranges failed: single element queries incorrect` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Segment tree edge ranges exception: ${error.message}` };
        }
    }

    private async testTopologicalSortComplexDAG(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', ['B', 'C']);
            graph.set('B', ['D', 'E']);
            graph.set('C', ['F']);
            graph.set('D', ['G']);
            graph.set('E', ['G']);
            graph.set('F', ['G']);
            graph.set('G', []);
            
            const result = this.engine.topologicalSort(graph);
            
            if (result.hasCycle || result.order.length !== 7) {
                return { success: false, error: `Topological sort complex DAG failed: should not have cycle and should have 7 nodes` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Topological sort complex DAG exception: ${error.message}` };
        }
    }

    private async testTopologicalSortSingleNode(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', []);
            
            const result = this.engine.topologicalSort(graph);
            
            if (result.hasCycle || result.order.length !== 1 || result.order[0] !== 'A') {
                return { success: false, error: `Topological sort single node failed: should have order ['A']` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Topological sort single node exception: ${error.message}` };
        }
    }

    private async testTopologicalSortDisconnected(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('A', ['B']);
            graph.set('B', []);
            graph.set('C', ['D']);
            graph.set('D', []);
            
            const result = this.engine.topologicalSort(graph);
            
            if (result.hasCycle || result.order.length !== 4) {
                return { success: false, error: `Topological sort disconnected failed: should process all 4 nodes` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Topological sort disconnected exception: ${error.message}` };
        }
    }

    private async testConvexHullCollinear(): Promise<{ success: boolean; error: string }> {
        try {
            const points = [
                { x: 0, y: 0 },
                { x: 1, y: 1 },
                { x: 2, y: 2 },
                { x: 3, y: 3 }
            ];
            
            const result = this.engine.convexHull(points);
            
            if (result.hull.length < 2) {
                return { success: false, error: `Convex hull collinear failed: should handle collinear points` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Convex hull collinear exception: ${error.message}` };
        }
    }

    private async testConvexHullSquare(): Promise<{ success: boolean; error: string }> {
        try {
            const points = [
                { x: 0, y: 0 },
                { x: 0, y: 2 },
                { x: 2, y: 2 },
                { x: 2, y: 0 },
                { x: 1, y: 1 }
            ];
            
            const result = this.engine.convexHull(points);
            
            if (result.hull.length !== 4) {
                return { success: false, error: `Convex hull square failed: should have 4 vertices, got ${result.hull.length}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Convex hull square exception: ${error.message}` };
        }
    }

    private async testConvexHullLargeSet(): Promise<{ success: boolean; error: string }> {
        try {
            const points: { x: number; y: number }[] = [];
            for (let i = 0; i < 100; i++) {
                points.push({ x: Math.random() * 100, y: Math.random() * 100 });
            }
            
            const result = this.engine.convexHull(points);
            
            if (result.hull.length < 3) {
                return { success: false, error: `Convex hull large set failed: hull should have at least 3 points` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Convex hull large set exception: ${error.message}` };
        }
    }

    // Additional KMP Tests
    private async testKMPOverlappingPatterns(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'abababab';
            const pattern = 'abab';
            
            const result = this.engine.kmpSearch(text, pattern);
            
            if (result.matches.length < 2) {
                return { success: false, error: `KMP overlapping patterns failed: should find overlapping matches` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP overlapping patterns exception: ${error.message}` };
        }
    }

    private async testKMPLongPattern(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'the quick brown fox jumps over the lazy dog';
            const pattern = 'quick brown fox';
            
            const result = this.engine.kmpSearch(text, pattern);
            
            if (result.matches.length === 0) {
                return { success: false, error: `KMP long pattern failed: should find the pattern` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP long pattern exception: ${error.message}` };
        }
    }

    private async testKMPRepeatingPattern(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'abcabcabcabc';
            const pattern = 'abcabc';
            
            const result = this.engine.kmpSearch(text, pattern);
            
            if (result.matches.length === 0) {
                return { success: false, error: `KMP repeating pattern failed: should find repeating pattern` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP repeating pattern exception: ${error.message}` };
        }
    }

    private async testKMPNoMatch(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'hello world';
            const pattern = 'xyz';
            
            const result = this.engine.kmpSearch(text, pattern);
            
            if (result.matches.length !== 0) {
                return { success: false, error: `KMP no match failed: should not find any matches` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP no match exception: ${error.message}` };
        }
    }

    private async testKMPSingleCharacter(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'aaaaaaa';
            const pattern = 'a';
            
            const result = this.engine.kmpSearch(text, pattern);
            
            if (result.matches.length !== 7) {
                return { success: false, error: `KMP single character failed: should find 7 matches, got ${result.matches.length}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP single character exception: ${error.message}` };
        }
    }

    private async testKMPPatternLengthEdges(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'test';
            const longPattern = 'testlongpattern';
            
            const result = this.engine.kmpSearch(text, longPattern);
            
            if (result.matches.length !== 0) {
                return { success: false, error: `KMP pattern length edges failed: long pattern should not match short text` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `KMP pattern length edges exception: ${error.message}` };
        }
    }

    // NEW EXPERT LEVEL TESTS
    private async testSuffixArrayComplexString(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'mississippi';
            const result = this.engine.buildSuffixArray(text);
            
            if (result.suffixArray.length !== text.length) {
                return { success: false, error: `Suffix array complex string failed: incorrect array length` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Suffix array complex string exception: ${error.message}` };
        }
    }

    private async testSuffixArrayPalindromes(): Promise<{ success: boolean; error: string }> {
        try {
            const text = 'racecar';
            const result = this.engine.buildSuffixArray(text);
            
            if (result.suffixArray.length !== text.length) {
                return { success: false, error: `Suffix array palindromes failed: incorrect array length` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Suffix array palindromes exception: ${error.message}` };
        }
    }

    private async testMaxFlowBottleneck(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            graph.set('S', new Map([['A', 100], ['B', 100]]));
            graph.set('A', new Map([['T', 1]]));
            graph.set('B', new Map([['T', 1]]));
            graph.set('T', new Map());
            
            const result = this.engine.maxFlow(graph, 'S', 'T');
            
            if (result.maxFlow !== 2) {
                return { success: false, error: `Max flow bottleneck failed: expected flow 2, got ${result.maxFlow}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Max flow bottleneck exception: ${error.message}` };
        }
    }

    private async testMaxFlowLargeNetwork(): Promise<{ success: boolean; error: string }> {
        try {
            const graph = new Map();
            const nodes = ['S', 'A', 'B', 'C', 'D', 'E', 'T'];
            
            graph.set('S', new Map([['A', 10], ['B', 10]]));
            graph.set('A', new Map([['C', 25], ['D', 6]]));
            graph.set('B', new Map([['D', 14], ['E', 10]]));
            graph.set('C', new Map([['T', 10]]));
            graph.set('D', new Map([['E', 10], ['T', 10]]));
            graph.set('E', new Map([['T', 10]]));
            graph.set('T', new Map());
            
            const result = this.engine.maxFlow(graph, 'S', 'T');
            
            if (result.maxFlow <= 0) {
                return { success: false, error: `Max flow large network failed: flow should be positive` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Max flow large network exception: ${error.message}` };
        }
    }

    private async testBloomFilterHighLoad(): Promise<{ success: boolean; error: string }> {
        try {
            const filter = this.engine.createBloomFilter(1000, 0.01);
            
            for (let i = 0; i < 2000; i++) {
                this.engine.bloomAdd(filter, `item${i}`);
            }
            
            const result = this.engine.bloomContains(filter, 'item500');
            
            if (result.falsePositiveRate <= 0 || result.falsePositiveRate >= 1) {
                return { success: false, error: `Bloom filter high load failed: false positive rate should be meaningful` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Bloom filter high load exception: ${error.message}` };
        }
    }

    private async testBloomFilterErrorRate(): Promise<{ success: boolean; error: string }> {
        try {
            const filter = this.engine.createBloomFilter(100, 0.1);
            
            for (let i = 0; i < 50; i++) {
                this.engine.bloomAdd(filter, `item${i}`);
            }
            
            let falsePositives = 0;
            const testItems = 1000;
            
            for (let i = 1000; i < 1000 + testItems; i++) {
                const result = this.engine.bloomContains(filter, `item${i}`);
                if (result.mightContain) {
                    falsePositives++;
                }
            }
            
            const actualRate = falsePositives / testItems;
            
            if (actualRate > 0.2) {
                return { success: false, error: `Bloom filter error rate failed: false positive rate too high: ${actualRate}` };
            }
            
            return { success: true, error: '' };
        } catch (error: any) {
            return { success: false, error: `Bloom filter error rate exception: ${error.message}` };
        }
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // Determine which engine to use based on command line args
    let engine: BrokenAdvancedAlgorithms | PureLibraryAlgorithms;
    const engineArg = process.argv[2];
    
    if (engineArg && engineArg.includes('pure-library-algorithms')) {
        engine = new PureLibraryAlgorithms();
        console.log('📦 Using PURE LIBRARY algorithms (100% npm packages - maximally correc`t)');
    } else {
        engine = new BrokenAdvancedAlgorithms();
        console.log('💥 Using BROKEN algorithms for LLM benchmarking');
    }   
    
    const benchmark = new AdvancedAlgorithmsBenchmark(engine);
    
    // Set a global timeout to ensure we always output JSON
    const globalTimeout = setTimeout(() => {
        console.error('⏰ Global timeout reached - outputting partial results');
        console.log(JSON.stringify({
            passed: 0,
            total: 30,
            successRate: 0,
            errors: ['Global timeout: Test suite took too long to complete']
        }));
        process.exit(1);
    }, 30000); // Longer timeout for complex algorithms
    
    benchmark.runBenchmark().then(result => {
        clearTimeout(globalTimeout);
        // Output JSON result for subprocess parsing
        console.log(JSON.stringify({
            passed: result.passed,
            total: result.total,
            successRate: result.successRate,
            errors: result.errors,
            difficultyBreakdown: result.difficultyBreakdown
        }));
        process.exit(result.successRate < 10 ? 0 : 1);
    }).catch(error => {
        clearTimeout(globalTimeout);
        console.error('❌ Benchmark failed:', error);
        // Output error result as JSON
        console.log(JSON.stringify({
            passed: 0,
            total: 30,
            successRate: 0,
            errors: [error.message]
        }));
        process.exit(1);
    });
}