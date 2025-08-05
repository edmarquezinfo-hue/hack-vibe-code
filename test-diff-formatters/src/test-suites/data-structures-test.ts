#!/usr/bin/env bun

/**
 * Test suite for broken data structures
 * This should fail significantly without RealtimeCodeFixer fixes
 */

import { 
    BrokenBinarySearchTree, 
    BrokenHashTable, 
    BrokenStack, 
    BrokenQueue, 
    BrokenLinkedList, 
    BrokenPriorityQueue 
} from '../engines/broken-data-structures.js';
import TestErrorHandler from '../utils/test-error-handler.js';

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

export class DataStructuresBenchmark {
    private bst: BrokenBinarySearchTree;
    private hashTable: BrokenHashTable;
    private stack: BrokenStack<number>;
    private queue: BrokenQueue<string>;
    private linkedList: BrokenLinkedList<number>;
    private priorityQueue: BrokenPriorityQueue<string>;

    constructor(customEngine?: any) {
        // Setup global error handlers
        TestErrorHandler.setupGlobalErrorHandlers('DataStructuresBenchmark');
        
        // Initialize all data structures with error handling
        const bstResult = TestErrorHandler.safeInstantiate(BrokenBinarySearchTree, [], 'BrokenBinarySearchTree');
        this.bst = bstResult.result || null as any;
        
        const hashTableResult = TestErrorHandler.safeInstantiate(BrokenHashTable, [], 'BrokenHashTable');
        this.hashTable = hashTableResult.result || null as any;
        
        const stackResult = TestErrorHandler.safeInstantiate(BrokenStack<number>, [], 'BrokenStack');
        this.stack = stackResult.result || null as any;
        
        const queueResult = TestErrorHandler.safeInstantiate(BrokenQueue<string>, [], 'BrokenQueue');
        this.queue = queueResult.result || null as any;
        
        const linkedListResult = TestErrorHandler.safeInstantiate(BrokenLinkedList<number>, [], 'BrokenLinkedList');
        this.linkedList = linkedListResult.result || null as any;
        
        const priorityQueueResult = TestErrorHandler.safeInstantiate(BrokenPriorityQueue<string>, [], 'BrokenPriorityQueue');
        this.priorityQueue = priorityQueueResult.result || null as any;
    }

    async runBenchmark(): Promise<BenchmarkResult> {
        const startTime = performance.now();
        const tests: TestResult[] = [];
        let passed = 0;
        const errors: string[] = [];

        // Quick mode for faster testing
        const isQuickMode = process.env.QUICK_MODE === 'true';
        console.log('🚀 Starting Data Structures Test Suite');
        if (isQuickMode) {
            console.log('⚡ Quick Mode: Testing all data structures (6 total tests)');
        }

        // Test each data structure
        const testMethods = [
            { name: 'Binary Search Tree', method: () => this.testBST() },
            { name: 'Hash Table', method: () => this.testHashTable() },
            { name: 'Stack', method: () => this.testStack() },
            { name: 'Queue', method: () => this.testQueue() },
            { name: 'Linked List', method: () => this.testLinkedList() },
            { name: 'Priority Queue', method: () => this.testPriorityQueue() }
        ];

        let testCount = 1;
        for (const testMethod of testMethods) {
            console.log(`🧪 Test ${testCount}/${testMethods.length}: ${testMethod.name}`);
            
            const testStart = performance.now();
            try {
                const result = await TestErrorHandler.withTimeout(
                    testMethod.method(),
                    5000,
                    `${testMethod.name} test`
                );

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

        console.log('\\n📊 DATA STRUCTURES BENCHMARK RESULTS');
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
            suiteName: 'Broken Data Structures',
            passed,
            total: totalTests,
            successRate,
            errors,
            executionTime,
            details: tests
        };
    }

    private checkInitialization(obj: any, name: string): { success: boolean; error: string } {
        if (!obj) {
            return { success: false, error: `${name} was not properly initialized due to compilation errors` };
        }
        return { success: true, error: '' };
    }

    private async testBST(): Promise<{ success: boolean; error: string }> {
        try {
            this.bst.insert(5);
            this.bst.insert(3);
            this.bst.insert(7);
            this.bst.insert(1);
            this.bst.insert(9);

            if (!this.bst.search(7)) {
                return { success: false, error: "BST search failed: could not find inserted value 7" };
            }

            const traversal = this.bst.inOrderTraversal();
            const expected = [1, 3, 5, 7, 9];
            
            if (JSON.stringify(traversal) !== JSON.stringify(expected)) {
                return { success: false, error: `BST in-order traversal failed: expected [${expected}], got [${traversal}]` };
            }

            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `BST test exception: ${error.message}` };
        }
    }

    private async testHashTable(): Promise<{ success: boolean; error: string }> {
        try {
            this.hashTable.set("key1", "value1");
            this.hashTable.set("key2", "value2");
            this.hashTable.set("key3", "value3");

            if (this.hashTable.get("key2") !== "value2") {
                return { success: false, error: `Hash table get failed: expected 'value2', got '${this.hashTable.get("key2")}'` };
            }

            const keys = this.hashTable.keys();
            if (!keys.includes("key1") || !keys.includes("key2") || !keys.includes("key3")) {
                return { success: false, error: `Hash table keys failed: missing expected keys in [${keys}]` };
            }

            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Hash table test exception: ${error.message}` };
        }
    }

    private async testStack(): Promise<{ success: boolean; error: string }> {
        try {
            this.stack.push(1);
            this.stack.push(2);
            this.stack.push(3);

            const popped = this.stack.pop();
            if (popped !== 3) {
                return { success: false, error: `Stack pop failed: expected 3, got ${popped}` };
            }

            const peeked = this.stack.peek();
            if (peeked !== 2) {
                return { success: false, error: `Stack peek failed: expected 2, got ${peeked}` };
            }

            if (this.stack.isEmpty()) {
                return { success: false, error: `Stack isEmpty failed: should not be empty` };
            }

            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Stack test exception: ${error.message}` };
        }
    }

    private async testQueue(): Promise<{ success: boolean; error: string }> {
        try {
            this.queue.enqueue("first");
            this.queue.enqueue("second");
            this.queue.enqueue("third");

            const dequeued = this.queue.dequeue();
            if (dequeued !== "first") {
                return { success: false, error: `Queue dequeue failed: expected 'first', got '${dequeued}'` };
            }

            const front = this.queue.front();
            if (front !== "second") {
                return { success: false, error: `Queue front failed: expected 'second', got '${front}'` };
            }

            if (this.queue.isEmpty()) {
                return { success: false, error: `Queue isEmpty failed: should not be empty` };
            }

            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Queue test exception: ${error.message}` };
        }
    }

    private async testLinkedList(): Promise<{ success: boolean; error: string }> {
        try {
            if (!this.linkedList) {
                return { success: false, error: "Linked list was not properly initialized due to compilation errors" };
            }
            
            // Add small delays to allow timeout to work during long operations
            this.linkedList.append(1);
            await new Promise(resolve => setTimeout(resolve, 1));
            
            this.linkedList.append(2);
            await new Promise(resolve => setTimeout(resolve, 1));
            
            this.linkedList.append(3);
            await new Promise(resolve => setTimeout(resolve, 1));

            // Test operations with manual safeguards against infinite loops
            let index: number;
            try {
                // Since the linked list is broken and may have circular references,
                // let's try the operation but expect it to fail
                index = this.linkedList.find(2);
            } catch (error: any) {
                return { success: false, error: `Linked list find failed: ${error.message}` };
            }
            
            // The broken implementation will likely return wrong results
            if (index !== 1) {
                return { success: false, error: `Linked list find failed: expected index 1, got ${index}` };
            }

            let value: number | null;
            try {
                value = this.linkedList.get(1);
            } catch (error: any) {
                return { success: false, error: `Linked list get failed: ${error.message}` };
            }
            
            if (value !== 2) {
                return { success: false, error: `Linked list get failed: expected 2, got ${value}` };
            }

            const length = this.linkedList.getLength();
            if (length !== 3) {
                return { success: false, error: `Linked list length failed: expected 3, got ${length}` };
            }

            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Linked list test exception: ${error.message}` };
        }
    }

    private async testPriorityQueue(): Promise<{ success: boolean; error: string }> {
        try {
            this.priorityQueue.enqueue("low", 1);
            this.priorityQueue.enqueue("high", 5);
            this.priorityQueue.enqueue("medium", 3);

            const first = this.priorityQueue.dequeue();
            if (first !== "high") {
                return { success: false, error: `Priority queue dequeue failed: expected 'high', got '${first}'` };
            }

            const peeked = this.priorityQueue.peek();
            if (peeked !== "medium") {
                return { success: false, error: `Priority queue peek failed: expected 'medium', got '${peeked}'` };
            }

            return { success: true, error: "" };
        } catch (error: any) {
            return { success: false, error: `Priority queue test exception: ${error.message}` };
        }
    }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const benchmark = new DataStructuresBenchmark();
    
    // Set a global timeout to ensure we always output JSON
    const globalTimeout = setTimeout(() => {
        console.error('⏰ Global timeout reached - outputting partial results');
        // Output timeout result as JSON
        console.log(JSON.stringify({
            passed: 0,
            total: 6,
            successRate: 0,
            errors: ['Global timeout: Test suite took too long to complete']
        }));
        process.exit(1);
    }, 4000); // Slightly less than the 5-second subprocess timeout
    
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