/**
 * Test Error Handler Utilities
 * Provides comprehensive error handling for test suites to handle compilation issues
 */

export interface SafeExecutionResult<T = any> {
    success: boolean;
    result?: T;
    error?: string;
    compilationError?: boolean;
}

export class TestErrorHandler {
    /**
     * Safely execute a function with comprehensive error handling
     */
    static async safeExecute<T>(
        fn: () => T | Promise<T>,
        context: string = 'operation'
    ): Promise<SafeExecutionResult<T>> {
        try {
            const result = await fn();
            return {
                success: true,
                result,
                compilationError: false
            };
        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error';
            const isCompilationError = this.isCompilationError(error);
            
            return {
                success: false,
                error: `${context}: ${errorMessage}`,
                compilationError: isCompilationError
            };
        }
    }

    /**
     * Safely instantiate a class with error handling
     */
    static safeInstantiate<T>(
        ClassConstructor: new (...args: any[]) => T,
        args: any[] = [],
        className: string = 'Class'
    ): SafeExecutionResult<T> {
        try {
            const instance = new ClassConstructor(...args);
            return {
                success: true,
                result: instance,
                compilationError: false
            };
        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error';
            const isCompilationError = this.isCompilationError(error);
            
            console.warn(`⚠️  Failed to instantiate ${className}: ${errorMessage}`);
            
            return {
                success: false,
                error: `Failed to instantiate ${className}: ${errorMessage}`,
                compilationError: isCompilationError
            };
        }
    }

    /**
     * Check if an error is likely a compilation error
     */
    static isCompilationError(error: any): boolean {
        const errorMessage = error?.message?.toLowerCase() || '';
        
        return errorMessage.includes('cannot find module') ||
               errorMessage.includes('unexpected token') ||
               errorMessage.includes('syntax error') ||
               errorMessage.includes('is not defined') ||
               errorMessage.includes('is not a constructor') ||
               errorMessage.includes('is not a function') ||
               errorMessage.includes('cannot read property') ||
               errorMessage.includes('cannot access before initialization') ||
               error?.name === 'SyntaxError' ||
               error?.name === 'ReferenceError' ||
               error?.name === 'TypeError';
    }

    /**
     * Setup global error handlers for a test suite
     */
    static setupGlobalErrorHandlers(suiteName: string): void {
        // Handle unhandled promise rejections
        if (typeof process !== 'undefined') {
            process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
                console.error(`🔥 Unhandled Promise Rejection in ${suiteName}:`, reason);
                console.error('Promise:', promise);
            });

            process.on('uncaughtException', (error: Error) => {
                console.error(`🔥 Uncaught Exception in ${suiteName}:`, error.message);
                console.error('Stack:', error.stack);
            });
        }

        // Handle window errors if in browser-like environment
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                console.error(`🔥 Global Error in ${suiteName}:`, event.error?.message || event.message);
            });

            window.addEventListener('unhandledrejection', (event) => {
                console.error(`🔥 Unhandled Promise Rejection in ${suiteName}:`, event.reason);
            });
        }
    }

    /**
     * Create a timeout wrapper for tests
     */
    static withTimeout<T>(
        promise: Promise<T>,
        timeoutMs: number = 5000,
        operation: string = 'operation'
    ): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            })
        ]);
    }

    /**
     * Safe method call with null checking
     */
    static safeMethodCall<T>(
        obj: any,
        methodName: string,
        args: any[] = [],
        fallbackValue?: T
    ): SafeExecutionResult<T> {
        try {
            if (!obj) {
                return {
                    success: false,
                    error: `Object is null - cannot call ${methodName}`,
                    compilationError: true
                };
            }

            if (typeof obj[methodName] !== 'function') {
                return {
                    success: false,
                    error: `Method ${methodName} is not a function or does not exist`,
                    compilationError: true
                };
            }

            const result = obj[methodName](...args);
            return {
                success: true,
                result,
                compilationError: false
            };
        } catch (error: any) {
            const errorMessage = error?.message || 'Unknown error';
            const isCompilationError = this.isCompilationError(error);
            
            return {
                success: false,
                error: `Method call ${methodName} failed: ${errorMessage}`,
                compilationError: isCompilationError,
                result: fallbackValue
            };
        }
    }

    /**
     * Format error message for display
     */
    static formatError(error: any, context?: string): string {
        const contextStr = context ? `[${context}] ` : '';
        
        if (typeof error === 'string') {
            return `${contextStr}${error}`;
        }
        
        if (error?.message) {
            return `${contextStr}${error.message}`;
        }
        
        if (error?.toString) {
            return `${contextStr}${error.toString()}`;
        }
        
        return `${contextStr}Unknown error: ${JSON.stringify(error)}`;
    }

    /**
     * Create a graceful degradation result for failed tests
     */
    static createGracefulFailure(
        testName: string,
        error: any,
        executionTime: number = 0
    ): { success: boolean; error: string; testResult: any } {
        const formattedError = this.formatError(error, testName);
        const isCompilation = this.isCompilationError(error);
        
        return {
            success: false,
            error: isCompilation 
                ? `${formattedError} (likely compilation error)`
                : formattedError,
            testResult: {
                testName,
                passed: false,
                error: formattedError,
                executionTime,
                compilationError: isCompilation
            }
        };
    }
}

// Default export for convenience
export default TestErrorHandler;