#!/usr/bin/env bun

/**
 * RealtimeCodeFixer Benchmark CLI
 * Tests the REAL RealtimeCodeFixer from worker/agents/assistants/realtimeCodeFixer.ts
 * 
 * Usage:
 *   bun benchmark-cli.ts benchmark --algorithms sorting --models gemini-flash
 *   bun benchmark-cli.ts --help
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { ALGORITHM_CATEGORIES } from './src/core/constants/config.js';
import { CodeFixer } from './src/runners/code-fixer.js';

// Load environment variables from .dev.vars
function loadEnvVars() {
    try {
        const envContent = readFileSync('.dev.vars', 'utf-8');
        const lines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        for (const line of lines) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        }
        console.log('✅ Loaded environment variables from .dev.vars');
    } catch (error) {
        console.log('⚠️  Could not load .dev.vars file');
    }
}

// Load environment
loadEnvVars();
process.env.QUICK_MODE = 'true';

// Ensure results/temp directory exists
const resultsDir = join(process.cwd(), 'results', 'temp');
try {
    mkdirSync(resultsDir, { recursive: true });
} catch (error) {
    // Directory might already exist
}

const env = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    CF_AI_BASE_URL: process.env.CF_AI_BASE_URL,
    CF_AI_API_KEY: process.env.CF_AI_API_KEY
};

// Function to format duration in a human-readable way
function formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
        return `${milliseconds.toFixed(0)}ms`;
    }
    
    const seconds = milliseconds / 1000;
    if (seconds < 60) {
        return `${seconds.toFixed(2)}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

// Function to save code files for inspection
function saveCodeForInspection(algorithmId: string, modelId: string, originalCode: string, fixedCode: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeModelId = modelId.replace(/[\/\\:*?"<>|]/g, '_');
    
    const originalPath = join(resultsDir, `${algorithmId}_${safeModelId}_${timestamp}_original.ts`);
    const fixedPath = join(resultsDir, `${algorithmId}_${safeModelId}_${timestamp}_fixed.ts`);
    
    try {
        writeFileSync(originalPath, originalCode);
        writeFileSync(fixedPath, fixedCode);
        console.log(`💾 Saved code to: ${originalPath.split('/').slice(-1)[0]} and ${fixedPath.split('/').slice(-1)[0]}`);
    } catch (error: any) {
        console.log(`⚠️  Could not save code files: ${error.message}`);
    }
}

async function runBenchmark(algorithms: string[], models: string[]) {
    console.log('🚀 RealtimeCodeFixer Benchmark Suite');
    console.log('=' .repeat(60));
    
    const codeFixer = new CodeFixer(env);
    
    // Simple API key check
    if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY && !env.GEMINI_API_KEY) {
        console.error('❌ No API keys found - check your .dev.vars file');
        process.exit(1);
    }
    console.log('✅ API keys loaded');
    
    console.log(`\\n🧮 Testing algorithms: ${algorithms.join(', ')}`);
    console.log(`🤖 Using models: ${models.join(', ')}`);
    console.log(`⚡ Quick mode enabled\\n`);
    
    for (const algorithmId of algorithms) {
        const category = ALGORITHM_CATEGORIES.find(cat => cat.id === algorithmId);
        
        if (!category) {
            console.error(`❌ Unknown algorithm: ${algorithmId}`);
            continue;
        }
        
        if (!existsSync(category.enginePath)) {
            console.error(`❌ Engine file not found: ${category.enginePath}`);
            continue;
        }
        
        console.log(`\\n🔬 TESTING: ${category.name.toUpperCase()}`);
        console.log('-' .repeat(50));
        
        for (const modelId of models) {
            console.log(`\\n📝 Model: ${modelId}`);
            
            try {
                // Step 1: Baseline test
                console.log('1️⃣ Running baseline test...');
                const baselineResult = await runTestSuite(category);
                console.log(`   Baseline: ${baselineResult.passed}/${baselineResult.total} tests passed (${baselineResult.successRate.toFixed(1)}%)`);
                
                // Step 2: Apply RealtimeCodeFixer
                console.log('\\n2️⃣ Applying RealtimeCodeFixer...');
                const originalCode = readFileSync(category.enginePath, 'utf-8');
                
                const llmStartTime = performance.now();
                const fixResult = await codeFixer.fixCode(originalCode, category, modelId);
                const llmEndTime = performance.now();
                const llmDuration = llmEndTime - llmStartTime;
                
                console.log(`⏱️  LLM Processing Time: ${formatDuration(llmDuration)}`);
                
                if (!fixResult.success) {
                    console.log('❌ Code fixing failed');
                    console.log(`Error: ${fixResult.llmDiff}`);
                    continue;
                }
                
                // Save original and fixed code for inspection
                saveCodeForInspection(algorithmId, modelId, originalCode, fixResult.fixedCode);
                
                // Step 3: Test fixed code
                console.log('\\n3️⃣ Testing fixed code...');
                const fixedResult = await testFixedCode(category, fixResult.fixedCode);
                console.log(`   Fixed: ${fixedResult.passed}/${fixedResult.total} tests passed (${fixedResult.successRate.toFixed(1)}%)`);
                
                // Step 4: Results
                const improvement = fixedResult.successRate - baselineResult.successRate;
                console.log(`\\n📊 RESULTS:`);
                console.log(`   LLM Processing Time: ${formatDuration(llmDuration)}`);
                console.log(`   Improvement: ${improvement.toFixed(1)}%`);
                console.log(`   Status: ${improvement > 0 ? '✅ SUCCESS' : '❌ NO IMPROVEMENT'}`);
                
            } catch (error: any) {
                console.error(`❌ Error: ${error.message}`);
            }
        }
    }
    
    console.log('\\n🎯 Benchmark completed!');
}

async function runTestSuite(category: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const testSuitePath = category.testSuitePath;
        
        // Run test suite in separate process with timeout
        const child = spawn('bun', [testSuitePath], {
            cwd: process.cwd(),
            env: { ...process.env, QUICK_MODE: 'true' },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log(`   📤 STDOUT: ${output.trim()}`);
        });

        child.stderr?.on('data', (data) => {
            const output = data.toString();
            stderr += output;
            console.log(`   📤 STDERR: ${output.trim()}`);
        });

        const timeout = setTimeout(() => {
            child.kill('SIGKILL');
            resolve({
                passed: 0,
                total: 1,
                successRate: 0,
                errors: ['Test suite timed out after 30 seconds']
            });
        }, 5000);

        child.on('close', (code) => {
            clearTimeout(timeout);
            console.log(`   📋 BASELINE Process exited with code: ${code}`);
            console.log(`   📋 BASELINE STDOUT length: ${stdout.length}, STDERR length: ${stderr.length}`);
            
            // Try to parse JSON result regardless of exit code
            const lines = stdout.trim().split('\n');
            console.log(`   📋 BASELINE Looking for JSON in ${lines.length} output lines`);
            for (let i = lines.length - 1; i >= 0; i--) {
                try {
                    const result = JSON.parse(lines[i]);
                    if (result.passed !== undefined && result.total !== undefined) {
                        console.log(`   📋 BASELINE Found JSON result: ${JSON.stringify(result)}`);
                        resolve(result);
                        return;
                    }
                } catch (e) {
                    // Continue searching for JSON result
                }
            }
            console.log(`   📋 BASELINE No valid JSON result found in output`);
            
            // If we can't parse results, return failure
            const failureResult = {
                passed: 0,
                total: 1,
                successRate: 0,
                errors: [`Test suite failed with code ${code}`, stderr]
            };
            console.log(`   📋 BASELINE Returning failure result: ${JSON.stringify(failureResult)}`);
            resolve(failureResult);
        });

        child.on('error', (error) => {
            clearTimeout(timeout);
            resolve({
                passed: 0,
                total: 1,
                successRate: 0,
                errors: [`Process error: ${error.message}`]
            });
        });
    });
}

async function testFixedCode(category: any, fixedCode: string): Promise<any> {
    const originalCode = readFileSync(category.enginePath, 'utf-8');
    
    return new Promise((resolve) => {
        try {
            // Temporarily replace file with fixed code
            console.log(`   🔧 Writing ${fixedCode.length} chars of fixed code to ${category.enginePath}`);
            writeFileSync(category.enginePath, fixedCode);
            console.log(`   🔧 File written successfully`);
            
            // Verify the write worked
            const writtenContent = readFileSync(category.enginePath, 'utf-8');
            console.log(`   🔧 Verified file has ${writtenContent.length} chars (should match ${fixedCode.length})`);
            
            const testSuitePath = category.testSuitePath;
            
            // Run test suite in separate process with timeout
            const child = spawn('bun', [testSuitePath], {
                cwd: process.cwd(),
                env: { ...process.env, QUICK_MODE: 'true' },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                console.log(`   🔧 FIXED STDOUT: ${output.trim()}`);
            });

            child.stderr?.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                console.log(`   🔧 FIXED STDERR: ${output.trim()}`);
            });

            const timeout = setTimeout(() => {
                child.kill('SIGKILL');
                // Always restore original file before resolving
                writeFileSync(category.enginePath, originalCode);
                resolve({
                    passed: 0,
                    total: 1,
                    successRate: 0,
                    errors: ['Fixed code test timed out after 30 seconds']
                });
            }, 30000);

            child.on('close', (code) => {
                clearTimeout(timeout);
                
                // Always restore original file
                writeFileSync(category.enginePath, originalCode);
                
                console.log(`   📋 FIXED Process exited with code: ${code}`);
                console.log(`   📋 FIXED STDOUT length: ${stdout.length}, STDERR length: ${stderr.length}`);
                
                // Try to parse JSON result regardless of exit code
                const lines = stdout.trim().split('\n');
                console.log(`   📋 FIXED Looking for JSON in ${lines.length} output lines`);
                for (let i = lines.length - 1; i >= 0; i--) {
                    try {
                        const result = JSON.parse(lines[i]);
                        if (result.passed !== undefined && result.total !== undefined) {
                            console.log(`   📋 FIXED Found JSON result: ${JSON.stringify(result)}`);
                            resolve(result);
                            return;
                        }
                    } catch (e) {
                        // Continue searching for JSON result
                    }
                }
                console.log(`   📋 FIXED No valid JSON result found in output`);
                
                // If we can't parse results, return failure
                const failureResult = {
                    passed: 0,
                    total: 1,
                    successRate: 0,
                    errors: [`Fixed code test failed with code ${code}`, stderr]
                };
                console.log(`   📋 FIXED Returning failure result: ${JSON.stringify(failureResult)}`);
                resolve(failureResult);
            });

            child.on('error', (error) => {
                clearTimeout(timeout);
                // Always restore original file
                writeFileSync(category.enginePath, originalCode);
                resolve({
                    passed: 0,
                    total: 1,
                    successRate: 0,
                    errors: [`Process error: ${error.message}`]
                });
            });
            
        } catch (error: any) {
            // Always restore original file on exception
            writeFileSync(category.enginePath, originalCode);
            resolve({
                passed: 0,
                total: 1,
                successRate: 0,
                errors: [`Setup error: ${error.message}`]
            });
        }
    });
}


// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log('RealtimeCodeFixer Benchmark CLI');
    console.log('');
    console.log('Usage:');
    console.log('  bun benchmark-cli.ts benchmark [options]');
    console.log('');
    console.log('Options:');
    console.log('  --algorithms <list>    Comma-separated algorithms to test');
    console.log('  --models <list>        Comma-separated models to use');
    console.log('  --help, -h             Show this help');
    console.log('');
    console.log('Available algorithms:');
    ALGORITHM_CATEGORIES.forEach(cat => {
        console.log(`  ${cat.id.padEnd(15)} - ${cat.name}`);
    });
    console.log('');
    console.log('Available models: gemini-flash, gpt-4o, claude-sonnet');
    console.log('');
    console.log('Examples:');
    console.log('  bun benchmark-cli.ts benchmark --algorithms sorting --models gemini-flash');
    console.log('  bun benchmark-cli.ts benchmark --algorithms sorting,graph --models gpt-4o');
    process.exit(0);
}

// Parse arguments
let algorithms = ['sorting']; // Default
let models = [
    'anthropic/claude-sonnet-4-20250514',
    'google-ai-studio/gemini-2.5-flash'
]; // Default

if (args[0] === 'benchmark') {
    for (let i = 1; i < args.length; i++) {
        if (args[i] === '--algorithms' && args[i + 1]) {
            algorithms = args[i + 1].split(',');
            i++;
        } else if (args[i] === '--models' && args[i + 1]) {
            models = args[i + 1].split(',');
            i++;
        }
    }
    
    // Run the benchmark
    runBenchmark(algorithms, models).catch(error => {
        console.error('❌ Benchmark failed:', error);
        process.exit(1);
    });
} else {
    console.error('❌ Unknown command. Use "benchmark" or --help');
    process.exit(1);
}