import { WebhookPayloadSchema, WebhookEvent, RunnerServiceWebhookPayloadSchema, WebhookRuntimeErrorEvent } from '../../services/sandbox/sandboxTypes';
import { WebhookContext } from '../../agents/services/interfaces/IWebhookHandler';
import { validateInput } from '../../middleware/security/inputValidator';
import { createObjectLogger, StructuredLogger } from '../../logger';
import { createHash, timingSafeEqual } from 'node:crypto';
import { BaseController } from './BaseController';

/**
 * Controller for handling incoming webhooks from runner service and other external sources
 * Provides secure webhook processing with signature validation and event routing
 */
export class WebhookController extends BaseController {
    private webhookLogger: StructuredLogger;

    constructor(private env: Env) {
        super();
        this.webhookLogger = createObjectLogger(this, 'WebhookController');
    }

    /**
     * Handle webhook from runner service
     * POST /api/webhook/runner/:agentId/:eventType
     */
    async handleRunnerWebhook(request: Request): Promise<Response> {
        try {
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/');
            
            // Extract agentId and eventType from URL path
            const agentId = pathParts[pathParts.length - 2];
            const eventType = pathParts[pathParts.length - 1];

            if (!agentId || !eventType) {
                return this.createErrorResponse('Missing agentId or eventType in URL path', 400);
            }

            this.webhookLogger.info('Received runner webhook', { agentId, eventType });

            // Handle current runner service payload format (direct payload, not wrapped)
            if (eventType === 'runtime_error') {
                return await this.handleCurrentRunnerServiceWebhook(request, agentId, eventType);
            }

            // For future webhook types, use the full webhook payload schema
            const webhookPayload = await validateInput(request, WebhookPayloadSchema);
            
            // Validate webhook signature if provided
            if (webhookPayload.signature) {
                const isValidSignature = await this.validateRunnerWebhookSignature(
                    request,
                    webhookPayload.signature,
                    webhookPayload.timestamp.toString()
                );
                
                if (!isValidSignature) {
                    this.webhookLogger.warn('Invalid webhook signature', { agentId, eventType });
                    return this.createErrorResponse('Invalid webhook signature', 401);
                }
            }

            // Create webhook context
            const context: WebhookContext = {
                agentId,
                instanceId: webhookPayload.event.instanceId,
                timestamp: new Date(webhookPayload.timestamp),
                source: 'runner_service'
            };

            // Process the webhook event
            const result = await this.processWebhookEvent(webhookPayload.event, context);

            if (!result.success) {
                this.webhookLogger.error('Failed to process webhook event', { 
                    agentId, 
                    eventType, 
                    error: result.error 
                });
                return this.createErrorResponse(result.error || 'Failed to process webhook event', 500);
            }

            this.webhookLogger.info('Successfully processed webhook event', { 
                agentId, 
                eventType, 
                message: result.message 
            });

            return this.createSuccessResponse({
                processed: true,
                message: result.message || 'Webhook processed successfully'
            });

        } catch (error) {
            this.webhookLogger.error('Error processing runner webhook', error);
            return this.createErrorResponse('Internal server error', 500);
        }
    }

    /**
     * Handle current runner service webhook format (runtime_error)
     */
    private async handleCurrentRunnerServiceWebhook(
        request: Request, 
        agentId: string, 
        eventType: string
    ): Promise<Response> {
        try {
            // Parse the direct runner service payload
            const runnerPayload = await validateInput(request, RunnerServiceWebhookPayloadSchema);

            this.webhookLogger.info('Processing current runner service webhook', {
                agentId,
                eventType,
                runId: runnerPayload.runId,
                errorMessage: runnerPayload.error.message
            });

            // Transform to internal webhook event format
            const webhookEvent: WebhookRuntimeErrorEvent = {
                eventType: 'runtime_error',
                instanceId: runnerPayload.runId,
                timestamp: new Date().toISOString(),
                agentId,
                payload: runnerPayload
            };

            // Create webhook context
            const context: WebhookContext = {
                agentId,
                instanceId: runnerPayload.runId,
                timestamp: new Date(),
                source: 'runner_service'
            };

            // Get the CodeGeneratorAgent instance
            const agentStub = this.env.CodeGenObject.get(this.env.CodeGenObject.idFromName(agentId));
            
            // Forward the runtime error to the agent via internal request
            await agentStub.fetch(new Request('https://internal/webhook/runtime-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event: webhookEvent,
                    context,
                    source: 'webhook'
                })
            }));

            this.webhookLogger.info('Successfully forwarded runtime error to agent', { 
                agentId, 
                runId: runnerPayload.runId 
            });

            return this.createSuccessResponse({
                processed: true,
                message: `Runtime error forwarded to agent ${agentId}`
            });

        } catch (error) {
            this.webhookLogger.error('Error processing current runner service webhook', error);
            return this.createErrorResponse('Failed to process runtime error webhook', 500);
        }
    }

    /**
     * Health check endpoint for webhooks
     * GET /api/webhook/health
     */
    async healthCheck(_request: Request): Promise<Response> {
        return this.createSuccessResponse({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'webhook-controller'
        });
    }

    /**
     * Validate webhook signature from runner service
     */
    private async validateRunnerWebhookSignature(
        request: Request,
        providedSignature: string,
        timestamp: string
    ): Promise<boolean> {
        try {
            // Get the webhook secret from environment
            const webhookSecret = this.env.WEBHOOK_SECRET;
            if (!webhookSecret) {
                this.webhookLogger.warn('No webhook secret configured, skipping signature validation');
                return true; // Allow if no secret is configured
            }

            // Get raw body for signature calculation
            const rawBody = await request.clone().text();
            
            // Create signature payload: timestamp + raw body
            const signaturePayload = `${timestamp}.${rawBody}`;
            
            // Calculate expected signature
            const expectedSignature = createHash('sha256')
                .update(signaturePayload, 'utf8')
                .digest('hex');
            
            // Compare signatures using timing-safe comparison
            const expectedBuffer = Buffer.from(`sha256=${expectedSignature}`, 'utf8');
            const providedBuffer = Buffer.from(providedSignature, 'utf8');
            
            if (expectedBuffer.length !== providedBuffer.length) {
                return false;
            }
            
            return timingSafeEqual(expectedBuffer, providedBuffer);
            
        } catch (error) {
            this.webhookLogger.error('Error validating webhook signature', error);
            return false;
        }
    }

    /**
     * Process webhook event using the appropriate handler
     */
    private async processWebhookEvent(
        event: WebhookEvent, 
        context: WebhookContext
    ): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            // For now, we'll handle the event directly in the controller
            // Later this can be moved to a dedicated service with handler registry
            
            switch (event.eventType) {
                case 'runtime_error':
                    return await this.handleRuntimeErrorEvent(event, context);
                    
                case 'build_status':
                    return await this.handleBuildStatusEvent(event, context);
                    
                case 'deployment_status':
                    return await this.handleDeploymentStatusEvent(event, context);
                    
                case 'instance_health':
                    return await this.handleInstanceHealthEvent(event, context);
                    
                case 'command_execution':
                    return await this.handleCommandExecutionEvent(event, context);
                    
                default:
                    this.webhookLogger.warn('Unhandled webhook event type', { eventType: (event as Record<string, unknown>).eventType });
                    return { success: true, message: 'Event type not handled, but acknowledged' };
            }
            
        } catch (error) {
            this.webhookLogger.error('Error processing webhook event', error);
            return { success: false, error: 'Failed to process webhook event' };
        }
    }

    /**
     * Handle runtime error webhook events
     */
    private async handleRuntimeErrorEvent(
        event: WebhookEvent & { eventType: 'runtime_error' }, 
        context: WebhookContext
    ): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            this.webhookLogger.info('Processing runtime error event', { 
                agentId: context.agentId,
                instanceId: context.instanceId,
                errorMessage: event.payload.error.message
            });

            // Get the CodeGeneratorAgent instance
            const agentStub = this.env.CodeGenObject.get(this.env.CodeGenObject.idFromName(context.agentId));
            
            // Forward the runtime error to the agent via WebSocket
            await agentStub.fetch(new Request('https://internal/webhook/runtime-error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    context,
                    source: 'webhook'
                })
            }));

            return { 
                success: true, 
                message: `Runtime error forwarded to agent ${context.agentId}` 
            };
            
        } catch (error) {
            this.webhookLogger.error('Failed to handle runtime error event', error);
            return { success: false, error: 'Failed to handle runtime error event' };
        }
    }

    /**
     * Handle build status webhook events
     */
    private async handleBuildStatusEvent(
        event: WebhookEvent & { eventType: 'build_status' }, 
        context: WebhookContext
    ): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            this.webhookLogger.info('Processing build status event', { 
                agentId: context.agentId,
                instanceId: context.instanceId,
                status: event.payload.status
            });

            // Get the CodeGeneratorAgent instance and forward the event
            const agentStub = this.env.CodeGenObject.get(this.env.CodeGenObject.idFromName(context.agentId));
            
            await agentStub.fetch(new Request('https://internal/webhook/build-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    context,
                    source: 'webhook'
                })
            }));

            return { 
                success: true, 
                message: `Build status event forwarded to agent ${context.agentId}` 
            };
            
        } catch (error) {
            this.webhookLogger.error('Failed to handle build status event', error);
            return { success: false, error: 'Failed to handle build status event' };
        }
    }

    /**
     * Handle deployment status webhook events
     */
    private async handleDeploymentStatusEvent(
        event: WebhookEvent & { eventType: 'deployment_status' }, 
        context: WebhookContext
    ): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            this.webhookLogger.info('Processing deployment status event', { 
                agentId: context.agentId,
                instanceId: context.instanceId,
                status: event.payload.status
            });

            // Forward to CodeGeneratorAgent
            const agentStub = this.env.CodeGenObject.get(this.env.CodeGenObject.idFromName(context.agentId));
            
            await agentStub.fetch(new Request('https://internal/webhook/deployment-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    context,
                    source: 'webhook'
                })
            }));

            return { 
                success: true, 
                message: `Deployment status event forwarded to agent ${context.agentId}` 
            };
            
        } catch (error) {
            this.webhookLogger.error('Failed to handle deployment status event', error);
            return { success: false, error: 'Failed to handle deployment status event' };
        }
    }

    /**
     * Handle instance health webhook events
     */
    private async handleInstanceHealthEvent(
        event: WebhookEvent & { eventType: 'instance_health' }, 
        context: WebhookContext
    ): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            this.webhookLogger.info('Processing instance health event', { 
                agentId: context.agentId,
                instanceId: context.instanceId,
                status: event.payload.status
            });

            // Only forward critical health events to avoid noise
            if (event.payload.status === 'unhealthy' || event.payload.status === 'shutting_down') {
                const agentStub = this.env.CodeGenObject.get(this.env.CodeGenObject.idFromName(context.agentId));
                
                await agentStub.fetch(new Request('https://internal/webhook/instance-health', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event,
                        context,
                        source: 'webhook'
                    })
                }));
            }

            return { 
                success: true, 
                message: `Instance health event processed for agent ${context.agentId}` 
            };
            
        } catch (error) {
            this.webhookLogger.error('Failed to handle instance health event', error);
            return { success: false, error: 'Failed to handle instance health event' };
        }
    }

    /**
     * Handle command execution webhook events
     */
    private async handleCommandExecutionEvent(
        event: WebhookEvent & { eventType: 'command_execution' }, 
        context: WebhookContext
    ): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            this.webhookLogger.info('Processing command execution event', { 
                agentId: context.agentId,
                instanceId: context.instanceId,
                command: event.payload.command,
                status: event.payload.status
            });

            // Forward to CodeGeneratorAgent for command tracking
            const agentStub = this.env.CodeGenObject.get(this.env.CodeGenObject.idFromName(context.agentId));
            
            await agentStub.fetch(new Request('https://internal/webhook/command-execution', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    context,
                    source: 'webhook'
                })
            }));

            return { 
                success: true, 
                message: `Command execution event forwarded to agent ${context.agentId}` 
            };
            
        } catch (error) {
            this.webhookLogger.error('Failed to handle command execution event', error);
            return { success: false, error: 'Failed to handle command execution event' };
        }
    }
}