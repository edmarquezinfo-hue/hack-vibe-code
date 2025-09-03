import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { getCORSConfig, getSecureHeadersConfig } from './config/security';
import { RateLimitService } from './services/rate-limit/rateLimits';
import { AppEnv } from './types/appenv';
import { setupRoutes } from './api/routes';
import { CsrfService } from './services/csrf/CsrfService';
import { SecurityError, SecurityErrorType } from './types/security';
import { getGlobalConfigurableSettings } from './config';

export function createApp(env: Env): Hono<AppEnv> {
    const appStart = performance.now();
    const app = new Hono<AppEnv>();

    // Apply global security middlewares (skip for WebSocket upgrades)
    const middlewareStart = performance.now();
    app.use('*', async (c, next) => {
        // Skip secure headers for WebSocket upgrade requests
        const upgradeHeader = c.req.header('upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
            return next();
        }
        // Apply secure headers
        return secureHeaders(getSecureHeadersConfig(env))(c, next);
    });
    
    // CORS configuration
    app.use('/api/*', cors(getCORSConfig(env)));
    
    // CSRF protection using double-submit cookie pattern with proper GET handling
    app.use('*', async (c, next) => {
        const method = c.req.method.toUpperCase();
        
        // Skip for WebSocket upgrades
        const upgradeHeader = c.req.header('upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
            return next();
        }
        
        try {
            // Handle GET requests - establish CSRF token if needed
            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                await next();
                
                // Only set CSRF token for successful API responses
                if (c.req.url.includes('/api/') && c.res.status < 400) {
                    await CsrfService.enforce(c.req.raw, c.res);
                }
                
                return;
            }
            
            // Validate CSRF token for state-changing requests
            await CsrfService.enforce(c.req.raw, undefined);
            await next();
        } catch (error) {
            if (error instanceof SecurityError && error.type === SecurityErrorType.CSRF_VIOLATION) {
                return new Response(JSON.stringify({ 
                    error: 'CSRF validation failed',
                    code: 'CSRF_VIOLATION'
                }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            throw error;
        }
    });

    const middlewareEnd = performance.now();
    const middlewareTime = middlewareEnd - middlewareStart;

    // Apply global config middleware
    const configMiddlewareStart = performance.now();
    app.use('/api/*', async (c, next) => {
        const configStart = performance.now();
        const config = await getGlobalConfigurableSettings(env);
        const configEnd = performance.now();
        const configTime = configEnd - configStart;
        if (configTime > 50) {
            console.log(`Global config retrieval took ${configTime.toFixed(2)}ms`);
        }
        c.set('config', config);
        await next();
    })

    // Apply global rate limit middleware. Should this be moved after setupRoutes so that maybe 'user' is available?
    app.use('/api/*', async (c, next) => {
        const rateLimitStart = performance.now();
        await RateLimitService.enforceGlobalApiRateLimit(env, c.get('config').security.rateLimit, c.get('user'), c.req.raw)
        const rateLimitEnd = performance.now();
        const rateLimitTime = rateLimitEnd - rateLimitStart;
        if (rateLimitTime > 30) {
            console.log(`Rate limit middleware took ${rateLimitTime.toFixed(2)}ms`);
        }
        await next();
    })
    
    const configMiddlewareEnd = performance.now();
    const configMiddlewareTime = configMiddlewareEnd - configMiddlewareStart;

    // // By default, all routes require authentication
    // app.use('/api/*', routeAuthMiddleware(AuthConfig.authenticated));

    // Now setup all the routes
    const routeSetupStart = performance.now();
    setupRoutes(env, app);
    const routeSetupEnd = performance.now();
    const routeSetupTime = routeSetupEnd - routeSetupStart;
    
    const appEnd = performance.now();
    const totalAppTime = appEnd - appStart;
    
    console.log(`App creation breakdown - Middleware: ${middlewareTime.toFixed(2)}ms, Config Middleware: ${configMiddlewareTime.toFixed(2)}ms, Routes: ${routeSetupTime.toFixed(2)}ms, Total: ${totalAppTime.toFixed(2)}ms`);

    // Add not found route to redirect to ASSETS
    app.notFound((c) => {
        return c.env.ASSETS.fetch(c.req.raw);
    });
    return app;
}