import { createLogger } from './logger';
import { setupRouter } from './api/routes/codegenRoutes';
import { errorResponse } from './api/responses';
import { SmartCodeGeneratorAgent } from "./agents/core/smartGeneratorAgent";
import { proxyToSandbox } from '@cloudflare/sandbox';

export class CodeGeneratorAgent extends SmartCodeGeneratorAgent {}
export { UserAppSandboxService, DeployerService } from './services/sandbox/sandboxSdkClient';

// Logger for the main application
const logger = createLogger('App');
/**
 * Main Worker fetch handler
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);
        const hostname = url.hostname;
        try {
            // Check if hostname is an ip address via regex
            const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/;
            if (!ipRegex.test(hostname)) {
                // Get the immideate subdomain of the hostname
                const subdomain = hostname.split('.')[0];
                // logger.info(`Subdomain: ${subdomain}, Hostname: ${hostname}`);
                // If the subdomain is not build, or there are less than 3 subdomains, redirect it to dispatcher
                // Thus either the main site should be build.somehost.com or build.something.somehost.com or something.com or www.something.com
                if (subdomain !== 'localhost' && subdomain !== 'www' && subdomain !== 'build' && hostname.split('.').length >= 2) {
                    const proxyResponse = await proxyToSandbox(request, env);
                    if (proxyResponse) return proxyResponse;
                    logger.info(`Dispatching request to dispatcher`);
                    // Get worker from dispatch namespace
                    const worker = env.DISPATCHER.get(subdomain);
                    if (worker) {
                        logger.info(`Dispatching request to worker ${subdomain}`);
                        // Dispatch request to worker
                        const response = await worker.fetch(request);
                        return response;
                    }
                }
            }
        } catch (error) {
            logger.warn(`Error dispatching request to dispatcher ${error}, will try to serve it from main worker`);
        }

        // If the request is NOT to /api, redirect it to assets
        if (!url.pathname.startsWith('/api')) {
            const response = await env.ASSETS.fetch(request);
            return response;
        }

        logger.info(`Handling the request ${url}`);

        // allow CORS preflight requests
        if (request.method === 'OPTIONS') {
            return new Response('', {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        try {
            // Ignore favicon requests
            if (url.pathname.startsWith('/favicon')) {
                return new Response('', { status: 404 });
            }

            logger.info(`${request.method} ${url.pathname}`);

            // Setup router and handle the request
            const router = setupRouter();
            return await router.handle(request, env, ctx);
        } catch (error) {
            logger.error('Unhandled error in fetch handler', error);
            return errorResponse(
                error instanceof Error ? error : 'Unknown error',
                500,
                'An unexpected error occurred'
            );
        }
    },
} satisfies ExportedHandler<Env>;
