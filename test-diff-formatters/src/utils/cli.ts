/**
 * CLI utilities with proper stdin handling and process management
 * Fixes hanging issues with user input
 */

import { stdin, stdout } from 'process';
import type { LogLevel } from '../core/types/common.js';
import { LOG_CONFIG } from '../core/constants/config.js';

export class CLIUtils {
    private static logLevel: LogLevel = LOG_CONFIG.DEFAULT_LEVEL;

    /**
     * Set the current log level
     */
    static setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Log a message with appropriate level and color
     */
    static log(level: LogLevel, message: string, ...args: any[]): void {
        const levelIndex = LOG_CONFIG.LEVELS.indexOf(level);
        const currentLevelIndex = LOG_CONFIG.LEVELS.indexOf(this.logLevel);
        
        if (levelIndex <= currentLevelIndex) {
            const color = LOG_CONFIG.COLORS[level];
            const reset = LOG_CONFIG.COLORS.reset;
            const timestamp = new Date().toISOString();
            
            console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${reset}`, ...args);
        }
    }

    /**
     * Print a banner with proper formatting
     */
    static printBanner(title: string, subtitle?: string): void {
        const width = 80;
        const border = '═'.repeat(width - 4);
        
        console.log(`╔══${border}══╗`);
        console.log(`║${' '.repeat(Math.floor((width - title.length) / 2 - 2))}${title}${' '.repeat(Math.ceil((width - title.length) / 2 - 2))}║`);
        
        if (subtitle) {
            console.log(`║${' '.repeat(Math.floor((width - subtitle.length) / 2 - 2))}${subtitle}${' '.repeat(Math.ceil((width - subtitle.length) / 2 - 2))}║`);
        }
        
        console.log(`╚══${border}══╝`);
        console.log('');
    }

    /**
     * Ask for user confirmation with timeout (fixes hanging issue)
     */
    static async askForConfirmation(
        message: string = 'Continue?', 
        timeoutMs: number = 10000,
        defaultAnswer: boolean = true
    ): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            console.log(`\\n${message} (y/n) [${defaultAnswer ? 'y' : 'n'}]: `);
            
            let answered = false;
            
            // Set timeout
            const timeout = setTimeout(() => {
                if (!answered) {
                    answered = true;
                    stdin.pause();
                    stdin.removeAllListeners('data');
                    console.log(`\\nTimeout reached. Using default: ${defaultAnswer ? 'yes' : 'no'}`);
                    resolve(defaultAnswer);
                }
            }, timeoutMs);

            // Handle Ctrl+C properly
            const onSigInt = () => {
                if (!answered) {
                    answered = true;
                    clearTimeout(timeout);
                    stdin.pause();
                    stdin.removeAllListeners('data');
                    console.log('\\n\\nOperation cancelled by user');
                    process.exit(0);
                }
            };
            
            process.once('SIGINT', onSigInt);

            // Set up stdin handling
            stdin.setEncoding('utf8');
            stdin.resume();

            const onData = (chunk: string) => {
                if (!answered) {
                    answered = true;
                    clearTimeout(timeout);
                    process.removeListener('SIGINT', onSigInt);
                    stdin.pause();
                    stdin.removeAllListeners('data');
                    
                    const input = chunk.trim().toLowerCase();
                    
                    if (input === '' || input === 'y' || input === 'yes') {
                        resolve(true);
                    } else if (input === 'n' || input === 'no') {
                        resolve(false);
                    } else {
                        // Invalid input, use default
                        console.log(`Invalid input. Using default: ${defaultAnswer ? 'yes' : 'no'}`);
                        resolve(defaultAnswer);
                    }
                }
            };

            stdin.on('data', onData);
        });
    }

    /**
     * Display a progress bar
     */
    static displayProgress(current: number, total: number, description: string = ''): void {
        const percentage = Math.round((current / total) * 100);
        const barLength = 40;
        const filledLength = Math.round((barLength * current) / total);
        
        const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        stdout.write(`\\r[${bar}] ${percentage}% ${description}`);
        
        if (current === total) {
            console.log(''); // New line when complete
        }
    }

    /**
     * Clear the current line
     */
    static clearLine(): void {
        stdout.write('\\r\\x1b[K');
    }

    /**
     * Display a spinner animation
     */
    static createSpinner(message: string = 'Loading...'): {
        start: () => void;
        stop: () => void;
        update: (newMessage: string) => void;
    } {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let index = 0;
        let intervalId: NodeJS.Timeout | null = null;
        let currentMessage = message;

        return {
            start: () => {
                if (!intervalId) {
                    intervalId = setInterval(() => {
                        stdout.write(`\\r${frames[index]} ${currentMessage}`);
                        index = (index + 1) % frames.length;
                    }, 80);
                }
            },
            
            stop: () => {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                    stdout.write('\\r\\x1b[K'); // Clear line
                }
            },
            
            update: (newMessage: string) => {
                currentMessage = newMessage;
            }
        };
    }

    /**
     * Format duration in human-readable form
     */
    static formatDuration(milliseconds: number): string {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else if (seconds > 0) {
            return `${seconds}s`;
        } else {
            return `${milliseconds}ms`;
        }
    }

    /**
     * Format file size in human-readable form
     */
    static formatFileSize(bytes: number): string {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    }

    /**
     * Create a table from data
     */
    static createTable(data: Record<string, any>[], headers?: string[]): string {
        if (data.length === 0) return 'No data to display';
        
        const keys = headers || Object.keys(data[0]);
        const columnWidths = keys.map(key => {
            const headerWidth = key.length;
            const dataWidth = Math.max(...data.map(row => String(row[key] || '').length));
            return Math.max(headerWidth, dataWidth) + 2;
        });

        const separator = '+-' + columnWidths.map(w => '-'.repeat(w)).join('-+-') + '-+';
        
        let table = separator + '\\n';
        
        // Header
        table += '| ' + keys.map((key, i) => key.padEnd(columnWidths[i] - 1)).join(' | ') + ' |\\n';
        table += separator + '\\n';
        
        // Data rows
        for (const row of data) {
            table += '| ' + keys.map((key, i) => 
                String(row[key] || '').padEnd(columnWidths[i] - 1)
            ).join(' | ') + ' |\\n';
        }
        
        table += separator;
        
        return table;
    }
}

/**
 * Enhanced error handling for CLI operations
 */
export class CLIErrorHandler {
    /**
     * Handle and format errors for CLI display
     */
    static handleError(error: any, context?: string): void {
        const timestamp = new Date().toISOString();
        
        console.error(`\\n${LOG_CONFIG.COLORS.error}❌ ERROR${context ? ` (${context})` : ''}: ${error.message}${LOG_CONFIG.COLORS.reset}`);
        
        if (error.stack && CLIUtils['logLevel'] === 'verbose') {
            console.error(`${LOG_CONFIG.COLORS.error}Stack trace:\\n${error.stack}${LOG_CONFIG.COLORS.reset}`);
        }
    }

    /**
     * Handle graceful shutdown
     */
    static setupGracefulShutdown(cleanupFn?: () => Promise<void>): void {
        const shutdown = async (signal: string) => {
            console.log(`\\n\\n${LOG_CONFIG.COLORS.warn}Received ${signal}. Shutting down gracefully...${LOG_CONFIG.COLORS.reset}`);
            
            if (cleanupFn) {
                try {
                    await cleanupFn();
                } catch (error: any) {
                    console.error(`Cleanup error: ${error.message}`);
                }
            }
            
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            console.error('Uncaught Exception:', error);
            process.exit(1);
        });
    }
}