import { createObjectLogger, Trace, StructuredLogger } from '../../logger'
import { generateBlueprint } from '../../agents/planning/blueprint';
import { SmartCodeGeneratorAgent } from '../../agents/core/smartGeneratorAgent';
import { getAgentByName } from 'agents';
import { selectTemplate } from '../../agents/planning/templateSelector';
import { SandboxSdkClient } from '../../services/sandbox/sandboxSdkClient';
import { WebSocketMessageResponses } from '../../agents/constants';
import { authMiddleware } from '../../middleware/security/auth';
import * as schema from '../../database/schema';
import { BaseController } from './BaseController';
import { getSandboxService } from '../../services/sandbox/factory';

interface CodeGenArgs {
    query: string;
    language?: string;
    frameworks?: string[];
    selectedTemplate?: string;
    agentMode: 'deterministic' | 'smart';
}

const defaultCodeGenArgs: CodeGenArgs = {
    query: '',
    language: 'typescript',
    frameworks: ['react', 'vite'],
    selectedTemplate: 'auto',
    agentMode: 'deterministic',
};

/**
 * CodeGenController to handle all code generation related endpoints
 */
export class CodeGenController extends BaseController {
    private codeGenLogger: StructuredLogger;

    constructor() {
        super();
        this.codeGenLogger = createObjectLogger(this, 'SimpleCodeGenController');
    }

    /**
     * Start the incremental code generation process
     */
    async startCodeGeneration(request: Request, env: Env, _: ExecutionContext): Promise<Response> {
        // Initialize new request context for distributed tracing
        const chatId = crypto.randomUUID();
        const requestId = chatId;
        const requestContext = Trace.startRequest(requestId, {
            endpoint: '/api/codegen/incremental',
            method: 'POST',
            userAgent: request.headers.get('user-agent') || 'unknown',
            timestamp: new Date().toISOString()
        });
        
        try {
            this.codeGenLogger.info('Starting code generation process', {
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                endpoint: '/api/codegen/incremental'
            });

            const url = new URL(request.url);
            const hostname = url.hostname === 'localhost' ? `localhost:${url.port}`: url.hostname;
            // Parse the query from the request body
            let body: CodeGenArgs;
            try {
                body = await request.json() as CodeGenArgs;
            } catch (error) {
                return this.createErrorResponse('Invalid JSON in request body', 400);
            }

            const query = body.query;
            if (!query) {
                return this.createErrorResponse('Missing "query" field in request body', 400);
            }

            const language = body.language || defaultCodeGenArgs.language;
            const frameworks = body.frameworks || defaultCodeGenArgs.frameworks;
            const agentMode = body.agentMode || defaultCodeGenArgs.agentMode;

            // Create a new agent instance with a generated ID - spawn the correct agent type
            const agentInstance = await getAgentByName<Env, SmartCodeGeneratorAgent>(env.CodeGenObject, chatId);

            this.codeGenLogger.info('Created new agent instance with ID: {chatId}', {
                chatId,
                requestId,
                traceId: requestContext.getCurrentTraceId(),
                agentMode,
                query: query.substring(0, 100) + (query.length > 100 ? '...' : '')
            });

            // If no template is selected, fetch available templates
            const templatesResponse = await SandboxSdkClient.listTemplates();
            if (!templatesResponse) {
                return this.createErrorResponse('Failed to fetch templates from sandbox service', 500);
            }

            const [analyzeQueryResponse, sandboxClient] = await Promise.all([
                selectTemplate({
                    env,
                    agentId: chatId,
                    query,
                    availableTemplates: templatesResponse.templates,
                }), 
                getSandboxService(chatId, hostname)
            ]);

            this.codeGenLogger.info('Selected template', { selectedTemplate: analyzeQueryResponse });

            // Find the selected template by name in the available templates
            if (!analyzeQueryResponse.selectedTemplateName) {
                this.codeGenLogger.error('No suitable template found for code generation');
                return this.createErrorResponse('No suitable template found for code generation', 404);
            }

            const selectedTemplate = templatesResponse.templates.find(template => template.name === analyzeQueryResponse.selectedTemplateName);
            if (!selectedTemplate) {
                this.codeGenLogger.error('Selected template not found');
                return this.createErrorResponse('Selected template not found', 404);
            }

            // Now fetch all the files from the instance
            const templateDetailsResponse = await sandboxClient.getTemplateDetails(selectedTemplate.name);
            if (!templateDetailsResponse.success || !templateDetailsResponse.templateDetails) {
                this.codeGenLogger.error('Failed to fetch files', { templateDetailsResponse });
                return this.createErrorResponse('Failed to fetch files', 500);
            }

            const templateDetails = templateDetailsResponse.templateDetails;

            // Generate a blueprint
            this.codeGenLogger.info('Generating blueprint', { query, queryLength: query.length });
            this.codeGenLogger.info(`Using language: ${language}, frameworks: ${frameworks ? frameworks.join(", ") : "none"}`);

            // Construct the response URLs
            const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/codegen/ws/${chatId}`;
            const httpStatusUrl = `${url.origin}/api/codegen/incremental/${chatId}`;

            const { readable, writable } = new TransformStream({
                transform(chunk, controller) {
                    if (chunk === "terminate") {
                        controller.terminate();
                    } else {
                        const encoded = new TextEncoder().encode(JSON.stringify(chunk) + '\n');
                        controller.enqueue(encoded);
                    }
                }
            });
            const writer = writable.getWriter();
            writer.write({
                message: 'Code generation started',
                agentId: chatId, // Keep as agentId for backward compatibility
                websocketUrl,
                httpStatusUrl,
                template: {
                    name: templateDetails.name,
                    files: templateDetails.files,
                }
            });

            // Check if user is authenticated
            const user = await authMiddleware(request, env);
            
            // Get session token from header for anonymous users
            const sessionToken = !user ? request.headers.get('X-Session-Token') || crypto.randomUUID() : null;
            
            generateBlueprint({
                env,
                agentId: chatId,
                query,
                language: language!,
                frameworks: frameworks!,
                templateDetails,
                templateMetaInfo: analyzeQueryResponse,
                stream: {
                    chunk_size: 256,
                    onChunk: (chunk) => {
                        writer.write({ chunk });
                    }
                }
            }).then(async (blueprint) => {
                this.codeGenLogger.info('Blueprint generated successfully');
                
                // Save the app to database for both authenticated and anonymous users
                if (user || sessionToken) {
                    try {
                        const dbService = this.createDbService(env);
                        
                        this.codeGenLogger.info('Attempting to save app to database', {
                            chatId,
                            userId: user?.id,
                            sessionToken: sessionToken,
                            title: blueprint.title || query.substring(0, 100),
                            hasDB: !!env.DB
                        });
                        
                        await dbService.db
                            .insert(schema.apps)
                            .values({
                                id: chatId, // Use chatId as the app ID
                                userId: user?.id || null,
                                sessionToken: sessionToken,
                                title: blueprint.title || query.substring(0, 100),
                                description: blueprint.description || null,
                                originalPrompt: query,
                                finalPrompt: query,
                                blueprint: blueprint,
                                framework: frameworks?.[0] || 'react',
                                visibility: user ? 'private' : 'public', // Anonymous apps default to public
                                status: 'generating',
                                createdAt: new Date(),
                                updatedAt: new Date()
                            });
                        
                        this.codeGenLogger.info('App saved successfully to database', { 
                            chatId, 
                            userId: user?.id, 
                            sessionToken: sessionToken,
                            visibility: user ? 'private' : 'public' 
                        });
                    } catch (error) {
                        this.codeGenLogger.error('Failed to save app to database', {
                            error: error instanceof Error ? error.message : String(error),
                            stack: error instanceof Error ? error.stack : undefined,
                            chatId,
                            userId: user?.id,
                            sessionToken: sessionToken
                        });
                    }
                } else {
                    this.codeGenLogger.info('No user or session token, skipping app save');
                }
                
                // Initialize the agent with the blueprint and query
                await agentInstance.initialize(query, blueprint, templateDetails, chatId, hostname, agentMode);
                
                this.codeGenLogger.info('Agent initialized successfully');
                writer.write("terminate");
            });

            return new Response(readable, {
                status: 200,
                headers: {
                    "content-type": "text/event-stream",
                    'Access-Control-Allow-Origin': '*',
                }
            });
        } catch (error) {
            this.codeGenLogger.error('Error starting code generation', error);
            return this.handleError(error, 'start code generation');
        }
    }

    /**
     * Get the current progress of code generation
     */
    async getCodeGenerationProgress(
        _: Request,
        env: Env,
        __: ExecutionContext,
        params?: Record<string, string>
    ): Promise<Response> {
        try {
            const chatId = params?.agentId; // URL param is still agentId for backward compatibility
            if (!chatId) {
                return this.createErrorResponse('Missing agent ID parameter', 400);
            }

            this.codeGenLogger.info(`Getting code generation progress for chat: ${chatId}`);

            // Get the agent instance and its current state
            const agentInstance = await getAgentByName<Env, SmartCodeGeneratorAgent>(env.CodeGenObject, chatId);
            const codeProgress = await agentInstance.getProgress();

            this.codeGenLogger.info('Retrieved code generation progress successfully');

            return this.createSuccessResponse({
                text_explanation: codeProgress.text_explaination,
                generated_code: codeProgress.generated_code,
                progress: {
                    completedFiles: codeProgress.generated_code.length,
                    totalFiles: codeProgress.total_files || 'unknown'
                }
            });
        } catch (error) {
            this.codeGenLogger.error('Error getting code generation progress', error);
            return this.handleError(error, 'get code generation progress');
        }
    }

    /**
     * Connect to an existing agent instance
     * Returns connection information for an already created agent
     */
    async connectToExistingAgent(
        request: Request,
        env: Env,
        _: ExecutionContext,
        params?: Record<string, string>
    ): Promise<Response> {
        try {
            const agentId = params?.agentId;
            if (!agentId) {
                return this.createErrorResponse('Missing agent ID parameter', 400);
            }

            this.codeGenLogger.info(`Connecting to existing agent: ${agentId}`);

            try {
                // Verify the agent instance exists
                const agentInstance = await getAgentByName<Env, SmartCodeGeneratorAgent>(env.CodeGenObject, agentId);
                
                // Get agent status
                const agentState = await agentInstance.getProgress();
                
                this.codeGenLogger.info(`Successfully connected to existing agent: ${agentId}`);

                // Construct WebSocket URL
                const url = new URL(request.url);
                const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/codegen/ws/${agentId}`;

                return this.createSuccessResponse({
                    agentId,
                    websocketUrl,
                    // status: await agentInstance.isCodeGenerating() ? 'generating' : 'idle',
                    progress: {
                        completedFiles: agentState.generated_code.length,
                        totalFiles: agentState.total_files || 'unknown'
                    }
                });
            } catch (error) {
                this.codeGenLogger.error(`Failed to connect to agent ${agentId}:`, error);
                return this.createErrorResponse(`Agent instance not found or unavailable: ${error instanceof Error ? error.message : String(error)}`, 404);
            }
        } catch (error) {
            this.codeGenLogger.error('Error connecting to existing agent', error);
            return this.handleError(error, 'connect to existing agent');
        }
    }

    /**
     * Handle WebSocket connections for code generation
     * This routes the WebSocket connection directly to the Agent
     */
    async handleWebSocketConnection(
        request: Request,
        env: Env,
        _: ExecutionContext,
        params?: Record<string, string>
    ): Promise<Response> {
        try {
            const chatId = params?.agentId; // URL param is still agentId for backward compatibility
            if (!chatId) {
                return this.createErrorResponse('Missing agent ID parameter', 400);
            }

            // Ensure the request is a WebSocket upgrade request
            if (request.headers.get('Upgrade') !== 'websocket') {
                return new Response('Expected WebSocket upgrade', { status: 426 });
            }

            this.codeGenLogger.info(`WebSocket connection request for chat: ${chatId}`);
            
            // Log request details for debugging
            const headers: Record<string, string> = {};
            request.headers.forEach((value, key) => {
                headers[key] = value;
            });
            this.codeGenLogger.info('WebSocket request details', {
                headers,
                url: request.url,
                chatId
            });

            try {
                // Get the agent instance to handle the WebSocket connection
                const agentInstance = await getAgentByName<Env, SmartCodeGeneratorAgent>(env.CodeGenObject, chatId);
                
                this.codeGenLogger.info(`Successfully got agent instance for chat: ${chatId}`);

                // Let the agent handle the WebSocket connection directly
                return agentInstance.fetch(request);
            } catch (error) {
                this.codeGenLogger.error(`Failed to get agent instance with ID ${chatId}:`, error);
                // Return an appropriate WebSocket error response
                // We need to emulate a WebSocket response even for errors
                const { 0: client, 1: server } = new WebSocketPair();

                server.accept();
                server.send(JSON.stringify({
                    type: WebSocketMessageResponses.ERROR,
                    error: `Failed to get agent instance: ${error instanceof Error ? error.message : String(error)}`
                }));

                server.close(1011, 'Agent instance not found');

                return new Response(null, {
                    status: 101,
                    webSocket: client
                });
            }
        } catch (error) {
            this.codeGenLogger.error('Error handling WebSocket connection', error);
            return this.handleError(error, 'handle WebSocket connection');
        }
    }
}