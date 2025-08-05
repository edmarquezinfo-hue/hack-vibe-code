import { Router } from '../router';
import { WebhookController } from '../controllers/webhookController';

/**
 * Setup webhook routes for external service integrations
 */
export function setupWebhookRoutes(router: Router): Router {
    // Create webhook controller factory function
    const createWebhookHandler = (method: keyof WebhookController) => {
        return async (request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> => {
            const controller = new WebhookController(env);
            return await controller[method](request);
        };
    };

    // Runner service webhook endpoint
    // POST /api/webhook/runner/:agentId/:eventType
    router.post('/api/webhook/runner/*', createWebhookHandler('handleRunnerWebhook'));
    
    // Webhook health check endpoint
    // GET /api/webhook/health
    router.get('/api/webhook/health', createWebhookHandler('healthCheck'));

    return router;
}