/**
 * Simplified Structured Logging System - Compatibility Layer
 * Clean, type-safe replacement for complex legacy logging system
 */

// Re-export new simplified logging system
export { createLogger, createObjectLogger, Logger, StructuredLogger, LoggerFactory } from './logger/index';
export { Context, Trace, LogMethod, WithLogger } from './logger/index';
export type { LoggerConfig, ObjectContext, LogEntry } from './logger/index';

// Legacy compatibility - old LogLevel enum (deprecated but maintained for compatibility)
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info', 
  WARN = 'warn',
  ERROR = 'error'
}