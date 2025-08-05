import { createLogger } from './logger';
import { setupRouter } from './api/routes/codegenRoutes';
import { errorResponse } from './api/responses';
import { SmartCodeGeneratorAgent } from "./agents/core/smartGeneratorAgent";

export class CodeGeneratorAgent extends SmartCodeGeneratorAgent {}
export { UserAppSandboxService } from './services/sandbox/sandboxSdkClient';

// Logger for the main application
const logger = createLogger('App');
/**
 * Main Worker fetch handler
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
            if (new URL(request.url).pathname.startsWith('/favicon')) {
                return new Response('', { status: 404 });
            }

            logger.info(`${request.method} ${new URL(request.url).pathname}`);

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
