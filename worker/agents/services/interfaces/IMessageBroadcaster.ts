/**
 * Interface for message broadcasting
 * Abstracts WebSocket or other communication mechanisms
 */
export interface IMessageBroadcaster {
    /**
     * Broadcast a message to all connected clients
     */
    broadcast(type: string, data: any): void;

    /**
     * Check if broadcaster is available
     */
    isAvailable(): boolean;
}

/**
 * Typed broadcast message for better type safety
 */
export interface BroadcastMessage {
    type: string;
    data: any;
    timestamp?: number;
}