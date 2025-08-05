/**
 * Advanced Structured Logging System - Legacy Compatibility Layer
 * This file provides backward compatibility while using the new structured logging system
 */

// Re-export new logging system
export { createLogger, createObjectLogger, Logger, Context, Trace, LogMethod, WithLogger } from './logger/index';
export type { LogContext, ObjectContext, LoggerConfig } from './logger/index';

// Legacy compatibility - old LogLevel enum (deprecated)
export enum LogLevel {
    DEBUG = 'debug',
    INFO = 'info', 
    WARN = 'warn',
    ERROR = 'error'
}

// For backward compatibility, also export the StructuredLogger class directly
export { StructuredLogger } from './logger/core';