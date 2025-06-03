/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Standardized logging utilities
 */

export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

/**
 * Logger class for consistent logging across the application
 */
export class Logger {
    private readonly context: string;

    constructor(context: string) {
        this.context = context;
    }

    /**
     * Format a log message with timestamp and context
     */
    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${this.context}] ${message}`;
    }

    /**
     * Log a debug message
     */
    debug(message: string, ...args: any[]): void {
        console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
    }

    /**
     * Log an info message
     */
    info(message: string, ...args: any[]): void {
        console.log(this.formatMessage(LogLevel.INFO, message), ...args);
    }

    /**
     * Log a warning message
     */
    warn(message: string, ...args: any[]): void {
        console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
    }

    /**
     * Log an error message
     */
    error(message: string, error?: any): void {
        console.error(this.formatMessage(LogLevel.ERROR, message));

        if (error) {
            if (error instanceof Error) {
                console.error(`${error.message}\n${error.stack}`);
            } else {
                console.error(error);
            }
        }
    }
}

/**
 * Create a logger for a specific context
 */
export function createLogger(context: string): Logger {
    return new Logger(context);
}