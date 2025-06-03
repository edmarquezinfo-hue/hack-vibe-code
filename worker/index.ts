import { createLogger } from './utils/logger';
import { Router } from './utils/router';
import { errorResponse } from './utils/responses';
import { CodeGenController } from './controllers/codeGenController';
// import { handleInsertRag, handleQueryRag } from "./rag";

// Export the CodeGenerator Agent as a Durable Object class named CodeGen
export { CodeGeneratorAgent } from "./codegen/codeGenerator";

// Logger for the main application
const logger = createLogger('App');

/**
 * Setup and configure the application router
 */
function setupRouter(): Router {
    const router = new Router();
    const codeGenController = new CodeGenController();

    router.post('/codegen/incremental', codeGenController.startCodeGeneration.bind(codeGenController));
    router.get('/codegen/incremental/:agentId', codeGenController.getCodeGenerationProgress.bind(codeGenController));

    // WebSocket endpoint for real-time code generation updates
    router.register('/codegen/ws/:agentId', codeGenController.handleWebSocketConnection.bind(codeGenController), ['GET']);

    // Default codegen path
    router.post('/codegen', codeGenController.startCodeGeneration.bind(codeGenController));

    return router;
}

/**
 * Main Worker fetch handler
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
