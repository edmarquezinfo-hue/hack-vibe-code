import { createObjectLogger, StructuredLogger } from '../logger';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage<T = any> {
    type: string;
    data?: T;
    error?: string;
}

/**
 * WebSocket handler for processing messages
 */
export type WebSocketMessageHandler = (
    message: unknown,
    webSocket: WebSocket,
    env: Env,
    ctx: ExecutionContext
) => Promise<void>;

/**
 * WebSocket manager for handling WebSocket connections
 */
export class WebSocketManager {
    private handlers: Record<string, WebSocketMessageHandler> = {};
    private logger: StructuredLogger;

    constructor() {
        this.logger = createObjectLogger(this, 'WebSocketManager');
    }

    /**
     * Register a message handler for a specific message type
     */
    registerHandler(type: string, handler: WebSocketMessageHandler): WebSocketManager {
        this.handlers[type] = handler;
        return this;
    }

    /**
     * Handle an incoming WebSocket connection
     */
    handleConnection(request: Request, env: Env, ctx: ExecutionContext): Response {
        // Check if the client is requesting a WebSocket upgrade
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected WebSocket upgrade', { status: 426 });
        }

        // Create a WebSocket pair
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(webSocketPair);

        // Set up event handlers on the server WebSocket
        server.accept();

        // Set up message handler
        server.addEventListener('message', async (event) => {
            try {
                const message = JSON.parse(event.data as string) as WebSocketMessage;
                this.logger.info(`Received WebSocket message: ${message.type}`);

                // Check if we have a handler for this message type
                const handler = this.handlers[message.type];
                if (handler) {
                    await handler(message, server, env, ctx);
                } else {
                    this.logger.warn(`No handler registered for message type: ${message.type}`);
                    this.sendError(server, `Unhandled message type: ${message.type}`);
                }
            } catch (error) {
                this.logger.error('Error handling WebSocket message', error);
                this.sendError(server, 'Failed to process message');
            }
        });

        // Handle errors
        server.addEventListener('error', (event) => {
            this.logger.error('WebSocket error', event);
        });

        // Handle close
        server.addEventListener('close', () => {
            this.logger.info('WebSocket connection closed');
        });

        // Return the client WebSocket to the client
        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    /**
     * Send a message to a WebSocket client
     */
    sendMessage<T = any>(webSocket: WebSocket, type: string, data?: T): void {
        try {
            const message: WebSocketMessage<T> = {
                type,
                data
            };
            webSocket.send(JSON.stringify(message));
        } catch (error) {
            this.logger.error('Error sending WebSocket message', error);
        }
    }

    /**
     * Send an error message to a WebSocket client
     */
    sendError(webSocket: WebSocket, error: string): void {
        try {
            const message: WebSocketMessage = {
                type: 'error',
                error
            };
            webSocket.send(JSON.stringify(message));
        } catch (error) {
            this.logger.error('Error sending WebSocket error message', error);
        }
    }
}