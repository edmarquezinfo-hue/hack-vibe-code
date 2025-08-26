# 🚀 RealtimeCodeFixer Professional Benchmark Suite

A **production-ready, professionally architected** benchmarking framework for evaluating Large Language Model (LLM) code fixing capabilities. Built with enterprise-grade code quality standards including low coupling, high cohesion, and DRY principles.

## 🎯 Key Improvements

### ✅ **Fixed Critical Issues**
- **No more CLI hanging** - Proper stdin handling and timeout management
- **Ctrl+C works correctly** - Graceful shutdown and process management
- **Safe test execution** - Timeout protection prevents infinite loops from broken algorithms
- **Professional error handling** - Comprehensive error reporting with context

### 🏗️ **Professional Architecture**
- **Low coupling** - Clear separation of concerns with well-defined interfaces
- **High cohesion** - Related functionality grouped together
- **DRY principles** - No code duplication, shared utilities and constants
- **Type safety** - Comprehensive TypeScript types and interfaces
- **Dependency injection** - Testable and maintainable component design

### 💻 **Enhanced CLI Experience**
- **Command-based interface** - `validate` and `benchmark` modes
- **Proper help system** - Context-sensitive help for each command
- **Safe execution** - No more hanging or broken processes
- **Professional output** - Clean, formatted, and informative

## 🏗️ Professional Architecture

```
test-diff-formatters/
├── benchmark-cli.ts                    # Main CLI entry point
├── src/
│   ├── core/                          # Core types, interfaces, constants
│   │   ├── types/
│   │   │   ├── common.ts              # Shared types and interfaces
│   │   │   └── benchmark.ts           # Benchmark-specific types
│   │   ├── interfaces/
│   │   │   ├── test-runner.ts         # Test execution contracts
│   │   │   └── benchmark.ts           # Benchmark execution contracts
│   │   └── constants/
│   │       └── config.ts              # Centralized configuration
│   ├── utils/                         # Shared utilities
│   │   ├── timeout.ts                 # Safe execution with timeouts
│   │   └── cli.ts                     # CLI utilities and helpers
│   ├── runners/                       # Execution engines
│   │   └── test-runner.ts             # Safe test suite execution
│   ├── cli/                          # Command handlers
│   │   └── commands/
│   │       └── validate.ts            # Validation command logic
│   ├── engines/                       # Broken algorithm implementations
│   └── test-suites/                   # Test validation suites
├── results/                           # Output directory
└── README.md                         # This file
```

## 🚀 Quick Start

### Prerequisites

```bash
# Bun runtime (latest version)
curl -fsSL https://bun.sh/install | bash

# Environment variables (.dev.vars file)
# Required for benchmark mode, optional for validate mode:
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key  
GOOGLE_AI_STUDIO_API_KEY=your_gemini_key
```

### Installation

```bash
cd test-diff-formatters
```

### Basic Usage

```bash
# 🧪 VALIDATE MODE (Recommended first step)
# Tests that algorithms are properly broken
bun benchmark-cli.ts validate

# List available algorithms and models
bun benchmark-cli.ts --list

# Validate specific algorithms
bun benchmark-cli.ts validate --algorithms sorting,data-structures

# Verbose validation
bun benchmark-cli.ts validate --algorithms graph --verbose

# Get help
bun benchmark-cli.ts --help
bun benchmark-cli.ts validate --help
```

## 📋 Commands

### 🧪 `validate` Command (Test-Only Mode)

**Purpose**: Verify that algorithm test suites work correctly and algorithms are appropriately broken.

```bash
# Validate all algorithms
bun benchmark-cli.ts validate

# Validate specific algorithms with detailed output
bun benchmark-cli.ts validate -a sorting,graph -v

# Quick validation with custom timeout  
bun benchmark-cli.ts validate -a data-structures -t 60
```

**Expected Results:**
- ✅ **Success rates < 10%** - Algorithms are properly broken
- ❌ **High success rates** - Algorithms may need more bugs
- ⚠️ **Execution errors** - Configuration or timeout issues

### 🔧 `benchmark` Command (Full Benchmark Mode)

**Purpose**: Test RealtimeCodeFixer's ability to fix broken algorithms using real LLM API calls.

```bash
# Full benchmark with all algorithms and models
bun benchmark-cli.ts benchmark

# Test specific algorithms with Claude only
bun benchmark-cli.ts benchmark --algorithms sorting,data-structures --models claude-sonnet

# Quick benchmark for testing
bun benchmark-cli.ts benchmark --quick --algorithms sorting

# Dry run to validate configuration
bun benchmark-cli.ts benchmark --dry-run --verbose

# Custom configuration
bun benchmark-cli.ts benchmark -a "sorting,graph" -m "claude-sonnet,gemini-flash" -i 2 -t 600
```

**⚠️ Note**: Benchmark mode makes real API calls and may incur costs. Always test with `--dry-run` first.

## 🧮 Algorithm Categories

Each category contains **intentionally broken** implementations designed to fail tests:

| Category | Algorithms | Bug Types | Expected Success Rate |
|----------|------------|-----------|---------------------|
| **sorting** | QuickSort, MergeSort, HeapSort, BubbleSort, SelectionSort, InsertionSort, RadixSort | Wrong comparisons, broken partitioning, incorrect merge logic | ~0% |
| **graph** | Dijkstra's, BFS, DFS, Kruskal's MST, Prim's MST, Topological Sort, Floyd-Warshall | Wrong distance calculations, broken priority queues, incorrect cycle detection | ~0% |
| **data-structures** | BST, Hash Table, Stack, Queue, Linked List, Priority Queue | Broken pointer manipulation, wrong hash functions, incorrect LIFO/FIFO behavior | ~0% |
| **pathfinding** | A* with optimizations | Incorrect heuristics, wrong cost calculations, broken boundary checking | ~0% |
| **game-engine** | 2D Physics Engine | Browser API dependencies, mathematical errors, compilation issues | ~0% |

## ⚙️ Configuration

### Command Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--help` | `-h` | Show help message | - |
| `--list` | | List algorithms and models | - |
| `--algorithms LIST` | `-a` | Algorithm IDs to test | all |
| `--timeout SECONDS` | `-t` | Timeout per operation | 30-1800s |
| `--verbose` | `-v` | Detailed logging | false |

### Algorithm IDs

- `sorting` - Sorting algorithms
- `graph` - Graph algorithms  
- `data-structures` - Data structures
- `pathfinding` - A* pathfinding
- `game-engine` - 2D physics engine

## 🛡️ Safety Features

### Timeout Protection
- **Per-test timeouts** prevent infinite loops
- **Global timeouts** prevent CLI hanging
- **Safe execution** with retry logic
- **Process isolation** for dangerous code

### Error Handling
- **Graceful degradation** when tests fail
- **Detailed error reporting** with context
- **Proper cleanup** on exit/interruption
- **Ctrl+C handling** that actually works

### Professional Logging
- **Structured logging** with timestamps
- **Color-coded output** for different log levels
- **Verbose mode** for debugging
- **Clean formatting** for production use

## 📊 Example Output

```
╔════════════════════════════════════════════════════════════════════════════════╗
║                          🧪 Test Suite Validation                          ║
║                  Verifying algorithms are properly broken                  ║
╚════════════════════════════════════════════════════════════════════════════════╝

INFO: Validating 2 algorithm categories:
  • Sorting Algorithms - Sorting algorithms with critical bugs
  • Data Structures - Fundamental data structures with implementation bugs

============================================================
📊 VALIDATION RESULTS
============================================================

📋 Individual Results:

+-----------------+--------+-------------+--------+-----------------------+
| Category        | Status | Success Rate| Time   | Notes                 |
+-----------------+--------+-------------+--------+-----------------------+
| Sorting         | ✅ Pass | 0.0%       | 2.3s   | Appropriately broken  |
| Data Structures | ✅ Pass | 1.2%       | 1.8s   | Appropriately broken  |
+-----------------+--------+-------------+--------+-----------------------+

============================================================
🎯 OVERALL VALIDATION RESULTS
============================================================
✅ Categories validated: 2/2
📈 Success rate: 100.0%

🎉 All test suites are properly configured!
   Algorithms show appropriately low success rates, indicating they are properly broken.
```

## 🔧 Development

### Code Quality Standards

- **TypeScript strict mode** - Full type safety
- **Interface segregation** - Single responsibility interfaces  
- **Dependency injection** - Testable components
- **Error boundaries** - Proper error handling
- **Resource cleanup** - Memory and process management

### Architecture Principles

1. **Separation of Concerns** - Each module has a single responsibility
2. **Dependency Inversion** - Depend on abstractions, not concretions
3. **Open/Closed Principle** - Open for extension, closed for modification
4. **DRY (Don't Repeat Yourself)** - Shared utilities and constants
5. **SOLID Principles** - Professional OOP design

### Adding New Algorithm Categories

1. **Create Engine**: Add broken implementation to `src/engines/`
2. **Create Test Suite**: Add validation tests to `src/test-suites/`  
3. **Register Category**: Add to `ALGORITHM_CATEGORIES` in `src/core/constants/config.ts`
4. **Update Runner**: Add import case to `src/runners/test-runner.ts`

## 🚨 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **CLI hangs** | ✅ Fixed with timeout management |
| **Ctrl+C doesn't work** | ✅ Fixed with proper signal handling |
| **Tests run forever** | ✅ Fixed with per-test timeouts |
| **Import errors** | Check file paths in `config.ts` |
| **Timeout errors** | Increase timeout with `-t` option |

### Debug Mode

```bash
# Enable verbose logging
bun benchmark-cli.ts validate --verbose

# Test single category for detailed output
bun benchmark-cli.ts validate -a sorting -v
```

## 🎯 Recommended Workflow

1. **Start with validation** - Verify algorithms are properly broken
   ```bash
   bun benchmark-cli.ts validate --verbose
   ```

2. **Test configuration** - Ensure API keys are working
   ```bash
   bun benchmark-cli.ts benchmark --dry-run --verbose
   ```

3. **Run quick benchmark** - Test RealtimeCodeFixer integration
   ```bash
   bun benchmark-cli.ts benchmark --quick --algorithms sorting
   ```

4. **Full benchmark** - Comprehensive evaluation
   ```bash
   bun benchmark-cli.ts benchmark
   ```

5. **Analyze results** - Review JSON output files for detailed insights

## 📜 Professional Standards

This codebase follows **enterprise-grade standards**:

- ✅ **Low coupling, high cohesion**
- ✅ **DRY principles applied**
- ✅ **Professional error handling** 
- ✅ **Type safety throughout**
- ✅ **Comprehensive testing**
- ✅ **Clean architecture**
- ✅ **Production-ready code quality**

---

**Ready to validate your algorithm test suites?**

```bash
bun benchmark-cli.ts validate --verbose
```