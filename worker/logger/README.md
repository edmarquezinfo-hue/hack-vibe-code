# Advanced Structured Logging System

A production-grade structured logging system built on Pino with automatic context injection, distributed tracing, and performance monitoring.

## 🚀 Key Features

- **Automatic Object Context Injection** - Object IDs and metadata automatically included in every log
- **Distributed Tracing** - Full correlation across operations with trace/span IDs
- **High Performance** - Built on Pino, the fastest JSON logger for Node.js
- **Zero Boilerplate** - Elegant decorators and automatic context propagation
- **Parent-Child Relationships** - Hierarchical logging with inherited context
- **Performance Timing** - Built-in operation timing and metrics
- **Production Ready** - Structured JSON output with pretty printing for development

## 🏃 Quick Start

```typescript
import { createLogger, createObjectLogger } from '../logger';

// Basic usage
const logger = createLogger('MyComponent');
logger.info('Server starting', { port: 3000 });

// Object logging with automatic context
class UserService {
  private id = 'user-svc-123';
  private logger = createObjectLogger(this, 'UserService');
  
  async getUser(userId: string) {
    // Automatically includes: component="UserService", object.type="UserService", object.id="user-svc-123"
    this.logger.info('Fetching user', { userId });
  }
}
```

## 📋 Migration from Old Logger

### Before (Old System):
```typescript
import { createLogger } from '../logger';
const logger = createLogger('MyComponent');
logger.info('Message', arg1, arg2, arg3);
logger.error('Error occurred', errorMessage);
```

### After (New System):
```typescript
import { createLogger } from '../logger';
const logger = createLogger('MyComponent');
logger.info('Message', { data1: arg1, data2: arg2, data3: arg3 });
logger.error('Error occurred', error, { additionalContext: 'value' });
```

## 🎯 Core API

### Basic Logging
```typescript
const logger = createLogger('ComponentName');

logger.trace('Trace level message', { details: 'object' });
logger.debug('Debug message', { userId: '123' });
logger.info('Info message', { requestId: 'req-456' });
logger.warn('Warning message', { threshold: 90 });
logger.error('Error occurred', error, { context: 'additional' });
logger.fatal('Fatal error', error, { system: 'database' });
```

### Object Logging (Recommended)
```typescript
class MyClass {
  private id = 'instance-123';
  private logger = createObjectLogger(this, 'MyClass');
  
  doSomething() {
    // Automatically includes object.type="MyClass", object.id="instance-123"
    this.logger.info('Operation started');
  }
}
```

### Performance Timing
```typescript
// Automatic timing
const result = await logger.measureAsync('database-query', async () => {
  return await db.query('SELECT * FROM users');
});

// Manual timing
logger.time('complex-operation');
// ... your code ...
logger.timeEnd('complex-operation', { recordsProcessed: 1000 });
```

### Distributed Tracing
```typescript
import { Trace, Context } from '../logger';

// Start request context
Context.startRequest('req-123', 'user-456', 'session-789');

// Operations automatically share trace context
await Trace.withSpanAsync('database-operation', async () => {
  const dbLogger = createLogger('Database');
  dbLogger.info('Executing query'); // Includes trace/span IDs
});
```

## 🏗️ Advanced Features

### Class Decorators
```typescript
import { WithLogger, LogMethod } from '../logger';

@WithLogger('UserController')
class UserController {
  // this.logger automatically available
  
  @LogMethod()
  async createUser(userData: any) {
    // Method entry/exit automatically logged with timing
    return await this.saveUser(userData);
  }
}
```

### Hierarchical Context
```typescript
class ParentService {
  private logger = createObjectLogger(this, 'ParentService');
  
  async process() {
    // Child inherits parent context
    const child = new ChildService(this.logger);
    await child.doWork();
  }
}

class ChildService {
  private logger: any;
  
  constructor(parentLogger: any) {
    this.logger = parentLogger.forObject(this, 'ChildService');
  }
  
  async doWork() {
    // Logs show: ParentService -> ChildService hierarchy
    this.logger.info('Child operation');
  }
}
```

## 🔧 Configuration

```typescript
import { Logger } from '../logger';

// Global configuration
Logger.configure({
  level: 'info',           // Log level
  prettyPrint: true,       // Pretty printing for development
  enableTiming: true,      // Performance timing
  enableTracing: true      // Distributed tracing
});
```

## 📊 Log Output Examples

### Development (Pretty Print):
```
[09:15:30] INFO: UserService[UserService#user-svc-123] Fetching user {
  "userId": "12345",
  "context": {
    "traceId": "trace-abc123",
    "spanId": "span-1-1678901234",
    "requestId": "req-789"
  }
}
```

### Production (JSON):
```json
{
  "level": "info",
  "time": "2024-01-15T09:15:30.123Z",
  "component": "UserService",
  "object": {
    "type": "UserService",
    "id": "user-svc-123"
  },
  "context": {
    "traceId": "trace-abc123",
    "spanId": "span-1-1678901234",
    "requestId": "req-789"
  },
  "msg": "Fetching user",
  "userId": "12345"
}
```

## 🚨 Migration Guide

1. **Replace logger creation:**
   ```typescript
   // Old: const logger = createLogger('Component');
   // New: const logger = createLogger('Component');  // Same!
   ```

2. **Update log calls:**
   ```typescript
   // Old: logger.info('Message', arg1, arg2);
   // New: logger.info('Message', { arg1, arg2 });
   ```

3. **For classes, use object logging:**
   ```typescript
   // Old: private logger = createLogger('ClassName');
   // New: private logger = createObjectLogger(this, 'ClassName');
   ```

4. **Error handling:**
   ```typescript
   // Old: logger.error('Failed', error.message);
   // New: logger.error('Failed', error, { additionalContext });
   ```

## ⚡ Performance

- **Zero-cost abstractions** - Context injection has minimal overhead
- **Async-safe** - All operations are async-safe with proper context propagation
- **Memory efficient** - Pino's streaming approach minimizes memory usage
- **CPU optimized** - JSON serialization is highly optimized

## 🔒 Production Considerations

- **Sensitive Data**: Automatically filters out common sensitive fields
- **Log Levels**: Use appropriate levels (debug for dev, info+ for production)
- **Context Size**: Keep context objects reasonably sized for performance
- **Error Handling**: Always pass Error objects, not just messages

## 📝 Best Practices

1. **Use object logging for classes**: Automatic context is invaluable for debugging
2. **Structure your data**: Use objects instead of string concatenation
3. **Include correlation IDs**: Use the tracing features for request correlation
4. **Time operations**: Use built-in timing for performance monitoring
5. **Hierarchical logging**: Create child loggers to show relationships

## 🐛 Troubleshooting

- **Missing context**: Ensure you're using `createObjectLogger` for classes
- **Performance issues**: Check log levels and context object sizes
- **Missing traces**: Verify `Context.startRequest()` is called at request start
- **Import errors**: Use the main `../logger` import, not submodules directly
