import { WebhookEvent } from '../../../services/sandbox/sandboxTypes';

/**
 * Result of processing a webhook event
 */
export interface WebhookProcessingResult {
    success: boolean;
    message?: string;
    error?: string;
    shouldBroadcast?: boolean;
    broadcastType?: string;
    broadcastData?: any;
}

/**
 * Context for webhook processing
 */
export interface WebhookContext {
    agentId: string;
    instanceId: string;
    sessionId?: string;
    timestamp: Date;
    source: 'runner_service';
}

/**
 * Interface for handling webhook events from external services
 * Provides abstraction for processing different types of webhook events
 */
export interface IWebhookHandler {
    /**
     * Process a webhook event from the runner service
     */
    processWebhookEvent(
        event: WebhookEvent, 
        context: WebhookContext
    ): Promise<WebhookProcessingResult>;

    /**
     * Validate webhook signature/authentication
     */
    validateWebhookSignature(
        payload: string, 
        signature: string, 
        timestamp: string
    ): boolean;

    /**
     * Check if this handler supports the given event type
     */
    canHandle(eventType: string): boolean;

    /**
     * Get the priority of this handler (higher numbers = higher priority)
     */
    getPriority(): number;
}

/**
 * Registry for webhook handlers
 * Allows registration and lookup of handlers by event type
 */
export interface IWebhookHandlerRegistry {
    /**
     * Register a webhook handler
     */
    registerHandler(handler: IWebhookHandler): void;

    /**
     * Get handlers for a specific event type
     */
    getHandlersForEvent(eventType: string): IWebhookHandler[];

    /**
     * Process an event using registered handlers
     */
    processEvent(
        event: WebhookEvent,
        context: WebhookContext
    ): Promise<WebhookProcessingResult[]>;
}