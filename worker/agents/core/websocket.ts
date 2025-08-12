import { Connection } from 'agents';
import { createLogger } from '../../logger';
import { WebSocketMessageRequests, WebSocketMessageResponses } from '../constants';
import { SimpleCodeGeneratorAgent } from './simpleGeneratorAgent';
import { WebSocketMessage, WebSocketMessageData, WebSocketMessageType } from '../websocketTypes';

const logger = createLogger('CodeGeneratorWebSocket');

export function handleWebSocketMessage(agent: SimpleCodeGeneratorAgent, connection: Connection, message: string): void {
    try {
        logger.info(`Received WebSocket message from ${connection.id}: ${message}`);
        const parsedMessage = JSON.parse(message);

        switch (parsedMessage.type) {
            case WebSocketMessageRequests.GENERATE_ALL:
                // Set shouldBeGenerating flag to indicate persistent intent
                agent.setState({ 
                    ...agent.state, 
                    shouldBeGenerating: true 
                });
                
                // Check if generation is already active to avoid duplicate processes
                if (agent.isGenerating) {
                    logger.info('Generation already in progress, skipping duplicate request');
                    // sendToConnection(connection, WebSocketMessageResponses.GENERATION_STARTED, {
                    //     message: 'Code generation is already in progress'
                    // });
                    return;
                }
                
                // Start generation process
                logger.info('Starting code generation process');
                agent.generateAllFiles().catch(error => {
                    logger.error('Error during code generation:', error);
                    sendError(connection, `Error generating files: ${error instanceof Error ? error.message : String(error)}`);
                }).finally(() => {
                    // Only clear shouldBeGenerating on successful completion
                    // (errors might want to retry, so this could be handled differently)
                    if (!agent.isGenerating) {
                        agent.setState({ 
                            ...agent.state, 
                            shouldBeGenerating: false 
                        });
                    }
                });
                break;
            case WebSocketMessageRequests.CODE_REVIEW:
                if (agent.isGenerating) {
                    sendError(connection, 'Cannot perform code review while generating files');
                    return;
                }
                sendToConnection(connection, WebSocketMessageResponses.CODE_REVIEW, {
                    message: 'Starting code review'
                });
                agent.reviewCode().then(reviewResult => {
                    if (!reviewResult) {
                        sendError(connection, 'Failed to perform code review');
                        return;
                    }
                    sendToConnection(connection, WebSocketMessageResponses.CODE_REVIEW, {
                        review: reviewResult,
                        issuesFound: reviewResult.issues_found,
                    });
                    if (reviewResult.issues_found && parsedMessage.autoFix === true) {
                        for (const fileToFix of reviewResult.files_to_fix) {
                            const fileToRegenerate = agent.state.generatedFilesMap[fileToFix.file_path];
                            if (!fileToRegenerate) {
                                logger.warn(`File to fix not found in generated files: ${fileToFix.file_path}`);
                                continue;
                            }
                            agent.regenerateFile(
                                fileToRegenerate,
                                fileToFix.issues,
                                0
                            ).catch((error: unknown) => {
                                logger.error(`Error regenerating file ${fileToRegenerate.file_path}:`, error);
                                sendError(connection, `Error regenerating file: ${error instanceof Error ? error.message : String(error)}`);
                            });
                        }
                    }
                }).catch(error => {
                    logger.error('Error during code review:', error);
                    sendError(connection, `Error during code review: ${error instanceof Error ? error.message : String(error)}`);
                });
                break;
            case WebSocketMessageRequests.DEPLOY:
                agent.deployToCloudflare().then((deploymentResult) => {
                    if (!deploymentResult) {
                        logger.error('Failed to deploy to Cloudflare Workers');
                        return;
                    }
                    logger.info('Successfully deployed to Cloudflare Workers!', deploymentResult);
                }).catch((error: unknown) => {
                    logger.error('Error during deployment:', error);
                });
                break;
            case WebSocketMessageRequests.PREVIEW:
                // Deploy current state for preview
                logger.info('Deploying for preview');
                agent.deployToSandbox().then((deploymentResult) => {
                    logger.info('Preview deployed successfully!, deploymentResult: ', deploymentResult);
                }).catch((error: unknown) => {
                    logger.error('Error during preview deployment:', error);
                });
                break;
            case WebSocketMessageRequests.RUNTIME_ERROR_FOUND:
                logger.info(`Client reported errors: ${parsedMessage.data}`);
                agent.setState({ ...agent.state, clientReportedErrors: parsedMessage.data });
                break;
            case WebSocketMessageRequests.SCREENSHOT_CAPTURED:
                logger.info('Screenshot captured from client', {
                    url: parsedMessage.data.url,
                    viewport: parsedMessage.data.viewport
                });
                
                // Save screenshot to agent state
                agent.setState({ 
                    ...agent.state, 
                    latestScreenshot: parsedMessage.data
                });
                
                logger.info(`Screenshot saved to state.`);
                break;
            case WebSocketMessageRequests.STOP_GENERATION:
                // Clear shouldBeGenerating flag when user manually stops
                logger.info('Stopping code generation and clearing shouldBeGenerating flag');
                agent.setState({ 
                    ...agent.state, 
                    shouldBeGenerating: false 
                });
                
                // If there's an active generation, we should signal it to stop
                // (This depends on how the generation process is implemented)
                agent.isGenerating = false;
                
                sendToConnection(connection, WebSocketMessageResponses.GENERATION_STOPPED, {
                    message: 'Code generation stopped by user'
                });
                break;
            case WebSocketMessageRequests.RESUME_GENERATION:
                // Set shouldBeGenerating and restart generation
                logger.info('Resuming code generation');
                agent.setState({ 
                    ...agent.state, 
                    shouldBeGenerating: true 
                });
                
                if (!agent.isGenerating) {
                    sendToConnection(connection, WebSocketMessageResponses.GENERATION_RESUMED, {
                        message: 'Code generation resumed'
                    });
                    agent.generateAllFiles().catch(error => {
                        logger.error('Error resuming code generation:', error);
                        sendError(connection, `Error resuming generation: ${error instanceof Error ? error.message : String(error)}`);
                    });
                } else {
                    // sendToConnection(connection, WebSocketMessageResponses.GENERATION_STARTED, {
                    //     message: 'Code generation is already in progress'
                    // });
                }
                break;
            case WebSocketMessageRequests.GITHUB_EXPORT:
                // Handle GitHub export request
                sendToConnection(connection, WebSocketMessageResponses.GITHUB_EXPORT_STARTED, {
                    message: 'Starting GitHub export...'
                });
                
                const exportOptions = {
                    repositoryName: parsedMessage.repositoryName || 'generated-app',
                    isPrivate: parsedMessage.isPrivate || false,
                    description: parsedMessage.description,
                    userId: parsedMessage.userId
                };
                
                agent.exportToGithub(exportOptions).then((result) => {
                    if (!result.success) {
                        sendToConnection(connection, WebSocketMessageResponses.GITHUB_EXPORT_ERROR, {
                            message: 'GitHub export failed',
                            error: result.error || 'Unknown error'
                        });
                        return;
                    }
                    
                    sendToConnection(connection, WebSocketMessageResponses.GITHUB_EXPORT_COMPLETED, {
                        message: `Successfully exported to GitHub: ${result.repositoryUrl}`,
                        repositoryUrl: result.repositoryUrl
                    });
                }).catch((error: unknown) => {
                    logger.error('Error during GitHub export:', error);
                    sendToConnection(connection, WebSocketMessageResponses.GITHUB_EXPORT_ERROR, {
                        message: 'GitHub export failed due to an unexpected error',
                        error: error instanceof Error ? error.message : String(error)
                    });
                });
                break;
            case WebSocketMessageRequests.USER_SUGGESTION:
                // Handle user suggestion for conversational AI
                logger.info('Received user suggestion', {
                    messageLength: parsedMessage.message?.length || 0
                });
                
                if (!parsedMessage.message) {
                    sendError(connection, 'No message provided in user suggestion');
                    return;
                }
                
                agent.handleUserInput(parsedMessage.message).catch((error: unknown) => {
                    logger.error('Error handling user suggestion:', error);
                    sendError(connection, `Error processing user suggestion: ${error instanceof Error ? error.message : String(error)}`);
                });
                break;
            default:
                sendError(connection, `Unknown message type: ${parsedMessage.type}`);
        }
    } catch (error) {
        logger.error('Error processing WebSocket message:', error);
        sendError(connection, `Error processing message: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function handleWebSocketClose(connection: Connection): void {
    logger.info(`WebSocket connection closed: ${connection.id}`);
}

export function broadcastToConnections<T extends WebSocketMessageType>(
    agent: { getWebSockets(): WebSocket[] },
    type: T,
    data: WebSocketMessageData<T>
): void {
    const connections = agent.getWebSockets();
    for (const connection of connections) {
        sendToConnection(connection, type, data);
    }
}

export function sendToConnection<T extends WebSocketMessageType>(
    connection: WebSocket, 
    type: T, 
    data: WebSocketMessageData<T>
): void {
    try {
        const message: WebSocketMessage = { type, ...data } as WebSocketMessage;
        connection.send(JSON.stringify(message));
    } catch (error) {
        console.error(`Error sending message to connection ${connection.url}:`, error);
    }
}

export function sendError(connection: WebSocket, errorMessage: string): void {
    sendToConnection(connection, 'error', { error: errorMessage });
}