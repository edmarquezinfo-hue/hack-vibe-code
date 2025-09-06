import { Hono } from 'hono';
// import { cors } from 'hono/cors';
// import { csrf } from 'hono/csrf';
import { secureHeaders } from 'hono/secure-headers';
// import { getCORSConfig } from './config/security';
import { getGlobalConfig } from './config';
import { RateLimitService } from './services/rate-limit/rateLimits';
import { authMiddleware } from './middleware/auth/auth';
import { AppEnv } from './types/appenv';
import { setupRoutes } from './api/routes';

export function createApp(env: Env): Hono<AppEnv> {
    const app = new Hono<AppEnv>();

    // Apply global security middlewares
    app.use('*', secureHeaders());
    // app.use('/api/*', cors(getCORSConfig(env)));
    // app.use('*', csrf({
    //     origin: ['http://localhost:5173', `https://${env.CUSTOM_DOMAIN}`],
    // }));

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
    return app;
}