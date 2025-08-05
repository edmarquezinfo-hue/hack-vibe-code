import { StructuredLogger } from '../../../logger';
import { WebSocketMessageResponses } from '../../constants';
import { WebSocketMessageType, WebSocketMessageData } from '../../websocketTypes';

export interface IMessageBroadcaster {
    broadcast<T extends WebSocketMessageType>(type: T, data: WebSocketMessageData<T>): void;
}

/**
 * Utility class to handle common error patterns and reduce code duplication
 */
export class ErrorHandler {
    /**
     * Handle operation errors with consistent logging and broadcasting
     */
    static handleOperationError<TReturn = null>(
        logger: StructuredLogger,
        broadcaster: IMessageBroadcaster,
        operation: string,
        error: unknown,
        messageType: WebSocketMessageType = WebSocketMessageResponses.ERROR,
        returnValue: TReturn = null as TReturn
    ): TReturn {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error during ${operation}:`, error);
        broadcaster.broadcast(messageType, {
            error: `Error during ${operation}: ${errorMessage}`
        });
        return returnValue;
    }

    /**
     * Validate runner instance availability
     */
    static validateRunnerInstance(
        runnerInstanceId: string | undefined,
        logger: StructuredLogger,
        broadcaster: IMessageBroadcaster,
        operation: string
    ): boolean {
        if (!runnerInstanceId) {
            const error = `No runner instance ID available for ${operation}`;
            logger.warn(error);
            broadcaster.broadcast(WebSocketMessageResponses.ERROR, { error });
            return false;
        }
        return true;
    }

    /**
     * Handle GitHub export specific errors with consistent messaging
     */
    static handleGitHubExportError(
        logger: StructuredLogger,
        broadcaster: IMessageBroadcaster,
        message: string,
        error: string
    ): { success: false; error: string } {
        logger.error('GitHub export error', { error });
        broadcaster.broadcast(WebSocketMessageResponses.GITHUB_EXPORT_ERROR, {
            message,
            error
        });
        return { success: false, error };
    }
}