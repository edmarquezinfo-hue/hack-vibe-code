/**
 * Configuration constants for the benchmark suite
 */

export const LOG_CONFIG = {
    DEFAULT_LEVEL: 'info' as const,
    LEVELS: ['debug', 'info', 'warn', 'error'] as const,
    COLORS: {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m',  // Green
        warn: '\x1b[33m',  // Yellow
        error: '\x1b[31m', // Red
        reset: '\x1b[0m'   // Reset to default color
    }
};

export const TIMEOUTS = {
    TEST_EXECUTION: 60000,     // 1 minute for test execution
    LLM_REQUEST: 90000,        // 90 seconds for LLM API calls
    TOTAL_BENCHMARK: 300000    // 5 minutes total benchmark timeout
};

export const ALGORITHM_CATEGORIES = [
    {
        id: 'sorting',
        name: 'Sorting Algorithms',
        description: 'Broken sorting algorithm implementations',
        enginePath: './src/engines/broken-sorting-algorithms.ts',
        testSuitePath: './src/test-suites/sorting-algorithms-test.ts',
        enabled: true,
        timeoutMs: 60000
    },
    {
        id: 'data-structures',
        name: 'Data Structures',
        description: 'Broken data structure implementations',
        enginePath: './src/engines/broken-data-structures.ts',
        testSuitePath: './src/test-suites/data-structures-test.ts',
        enabled: true,
        timeoutMs: 60000
    },
    {
        id: 'graph',
        name: 'Graph Algorithms',
        description: 'Broken graph algorithm implementations',
        enginePath: './src/engines/broken-graph-algorithms.ts',
        testSuitePath: './src/test-suites/graph-algorithms-test.ts',
        enabled: true,
        timeoutMs: 60000
    },
    {
        id: 'pathfinding',
        name: 'Pathfinding Algorithms',
        description: 'Broken pathfinding algorithm implementations',
        enginePath: './src/engines/pathfinding-engine.ts',
        testSuitePath: './src/test-suites/pathfinding-test.ts',
        enabled: true,
        timeoutMs: 60000
    },
    {
        id: 'game-engine',
        name: 'Game Engine Components',
        description: 'Broken game engine component implementations',
        enginePath: './src/engines/advanced-game-engine.ts',
        testSuitePath: './src/test-suites/game-engine-test.ts',
        enabled: true,
        timeoutMs: 60000
    },
    {
        id: 'advanced',
        name: 'Advanced Algorithms',
        description: 'Complex algorithms with challenging bugs - comprehensive LLM benchmark',
        enginePath: './src/engines/broken-advanced-algorithms.ts',
        testSuitePath: './src/test-suites/advanced-algorithms-test.ts',
        enabled: true,
        timeoutMs: 120000 // Longer timeout for complex algorithms
    }
];