import { WebSocketMessageType, WebSocketMessageData } from '../../websocketTypes';
import { IMessageBroadcaster } from '../interfaces/IMessageBroadcaster';

/**
 * WebSocket broadcaster implementation
 * Maintains exact behavioral compatibility with original broadcasting
 */
export class WebSocketBroadcaster implements IMessageBroadcaster {
    constructor(
        private agent: { broadcast: <T extends WebSocketMessageType>(type: T, data: WebSocketMessageData<T>) => void }
    ) {}

    broadcast<T extends WebSocketMessageType>(type: T, data: WebSocketMessageData<T>): void {
        this.agent.broadcast(type, data);
    }

    isAvailable(): boolean {
        return typeof this.agent.broadcast === 'function';
    }
}