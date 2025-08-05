/**
 * Timeout management utilities
 * Provides safe execution with timeout protection to prevent hanging
 */

import type { ITimeoutManager } from '../core/interfaces/test-runner.js';
import type { SafeExecutionResult } from '../core/types/common.js';
import { TIMEOUTS } from '../core/constants/config.js';

export class TimeoutManager implements ITimeoutManager {
    private activeTimeouts = new Set<NodeJS.Timeout>();

    async executeWithTimeout<T>(
        fn: () => Promise<T>, 
        timeoutMs: number = TIMEOUTS.TEST_EXECUTION,
        description: string = 'Operation'
    ): Promise<SafeExecutionResult<T>> {
        const startTime = performance.now();
        let timeoutHandle: NodeJS.Timeout;
        let completed = false;

        return new Promise<SafeExecutionResult<T>>((resolve) => {
            // Create timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    if (!completed) {
                        completed = true;
                        this.activeTimeouts.delete(timeoutHandle);
                        reject(new Error(`${description} timed out after ${timeoutMs}ms`));
                    }
                }, timeoutMs);
                this.activeTimeouts.add(timeoutHandle);
            });

            // Execute the function with timeout protection
            Promise.race([fn(), timeoutPromise])
                .then((data) => {
                    if (!completed) {
                        completed = true;
                        clearTimeout(timeoutHandle);
                        this.activeTimeouts.delete(timeoutHandle);
                        resolve({
                            success: true,
                            data,
                            timedOut: false,
                            executionTime: performance.now() - startTime
                        });
                    }
                })
                .catch((error) => {
                    if (!completed) {
                        completed = true;
                        clearTimeout(timeoutHandle);
                        this.activeTimeouts.delete(timeoutHandle);
                        
                        const isTimeout = error.message.includes('timed out');
                        resolve({
                            success: false,
                            error: error.message,
                            timedOut: isTimeout,
                            executionTime: performance.now() - startTime
                        });
                    }
                });
        });
    }

    async createTimeout(timeoutMs: number): Promise<void> {
        return new Promise<void>((resolve) => {
            const handle = setTimeout(() => {
                this.activeTimeouts.delete(handle);
                resolve();
            }, timeoutMs);
            this.activeTimeouts.add(handle);
        });
    }

    cancelAllTimeouts(): void {
        for (const timeout of this.activeTimeouts) {
            clearTimeout(timeout);
        }
        this.activeTimeouts.clear();
    }

    getActiveTimeoutCount(): number {
        return this.activeTimeouts.size;
    }
}

/**
 * Process isolation utilities for running dangerous code
 */
export class ProcessIsolation {
    /**
     * Execute code in a separate process to prevent hanging the main process
     */
    static async executeInIsolation<T>(
        code: string,
        timeoutMs: number = TIMEOUTS.TEST_EXECUTION
    ): Promise<SafeExecutionResult<T>> {
        const startTime = performance.now();
        
        return new Promise<SafeExecutionResult<T>>((resolve) => {
            const worker = new Worker(new URL('./isolated-runner.js', import.meta.url), {
                type: 'module'
            });

            let completed = false;
            const timeoutHandle = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    worker.terminate();
                    resolve({
                        success: false,
                        error: 'Execution timed out in isolation',
                        timedOut: true,
                        executionTime: performance.now() - startTime
                    });
                }
            }, timeoutMs);

            worker.onmessage = (event) => {
                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutHandle);
                    worker.terminate();
                    
                    if (event.data.success) {
                        resolve({
                            success: true,
                            data: event.data.result,
                            timedOut: false,
                            executionTime: performance.now() - startTime
                        });
                    } else {
                        resolve({
                            success: false,
                            error: event.data.error,
                            timedOut: false,
                            executionTime: performance.now() - startTime
                        });
                    }
                }
            };

            worker.onerror = (error) => {
                if (!completed) {
                    completed = true;
                    clearTimeout(timeoutHandle);
                    worker.terminate();
                    resolve({
                        success: false,
                        error: error.message,
                        timedOut: false,
                        executionTime: performance.now() - startTime
                    });
                }
            };

            // Send code to worker for execution
            worker.postMessage({ code });
        });
    }
}

/**
 * Utility for safe function execution with retries
 */
export class SafeExecutor {
    private timeoutManager = new TimeoutManager();

    async executeWithRetry<T>(
        fn: () => Promise<T>,
        maxRetries: number = 3,
        timeoutMs: number = TIMEOUTS.TEST_EXECUTION,
        description: string = 'Operation'
    ): Promise<SafeExecutionResult<T>> {
        let lastError = 'Unknown error';
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await this.timeoutManager.executeWithTimeout(
                    fn, 
                    timeoutMs, 
                    `${description} (attempt ${attempt}/${maxRetries})`
                );
                
                if (result.success) {
                    return result;
                }
                
                lastError = result.error || 'Unknown error';
                
                // Don't retry if it was a timeout
                if (result.timedOut) {
                    return result;
                }
                
                // Wait before retry (exponential backoff)
                if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt - 1) * 1000;
                    await this.timeoutManager.createTimeout(delayMs);
                }
                
            } catch (error: any) {
                lastError = error.message;
            }
        }

        return {
            success: false,
            error: `All ${maxRetries} attempts failed. Last error: ${lastError}`,
            timedOut: false,
            executionTime: 0
        };
    }

    cleanup(): void {
        this.timeoutManager.cancelAllTimeouts();
    }
}

// Export singleton instances
export const timeoutManager = new TimeoutManager();
export const safeExecutor = new SafeExecutor();

// Cleanup on process exit
process.on('exit', () => {
    timeoutManager.cancelAllTimeouts();
    safeExecutor.cleanup();
});

process.on('SIGINT', () => {
    timeoutManager.cancelAllTimeouts();
    safeExecutor.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    timeoutManager.cancelAllTimeouts(); 
    safeExecutor.cleanup();
    process.exit(0);
});