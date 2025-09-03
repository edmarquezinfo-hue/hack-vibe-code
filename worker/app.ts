import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { getCORSConfig, getSecureHeadersConfig } from './config/security';
import { getGlobalConfig } from './config';
import { RateLimitService } from './services/rate-limit/rateLimits';
import { authMiddleware } from './middleware/auth/auth';
import { AppEnv } from './types/appenv';
import { setupRoutes } from './api/routes';
import { CsrfService } from './services/csrf/CsrfService';

export function createApp(env: Env): Hono<AppEnv> {
    const app = new Hono<AppEnv>();

    // Apply global security middlewares (skip for WebSocket upgrades)
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

    // Vanilla CSRF protection
    app.use('*', cors(getCORSConfig(env)));
    
    // CSRF protection using double-submit cookie pattern
    app.use('*', async (c, next) => {
        const method = c.req.method.toUpperCase();
        
        // Skip CSRF for safe methods and WebSocket upgrades
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
            return next();
        }
        
        // Skip for WebSocket upgrades
        const upgradeHeader = c.req.header('upgrade');
        if (upgradeHeader?.toLowerCase() === 'websocket') {
            return next();
        }
        
        
        try {
            await CsrfService.enforce(c.req.raw);
            return next();
        } catch (error) {
            return new Response(JSON.stringify({ error: 'CSRF validation failed' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    });

    // Apply global config middleware
    app.use('/api/*', async (c, next) => {
        const config = await getGlobalConfig(env);
        c.set('config', config);
        await next();
    })

    // Apply global auth middleware
    app.use('/api/*', async (c, next) => {
        const user = await authMiddleware(c.req.raw, env);
        c.set('user', user);
        await next();
    })

    // Apply global rate limit middleware
    app.use('/api/*', async (c, next) => {
        await RateLimitService.enforceGlobalApiRateLimit(env, c.get('config').security.rateLimit, c.get('user'), c.req.raw)
        await next();
    })

    // // By default, all routes require authentication
    // app.use('/api/*', routeAuthMiddleware(AuthConfig.authenticated));

    // Now setup all the routes
    setupRoutes(env, app);

    // Add not found route to redirect to ASSETS
    app.notFound((c) => {
        return c.env.ASSETS.fetch(c.req.raw);
    });
    return app;
}