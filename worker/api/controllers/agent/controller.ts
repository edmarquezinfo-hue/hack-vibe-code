import { createObjectLogger, StructuredLogger } from '../../../logger'
import { WebSocketMessageResponses } from '../../../agents/constants';
import { BaseController } from '../BaseController';
import { generateId } from '../../../utils/idGenerator';
import { CodeGenState } from '../../../agents/core/state';
import { getAgentStub } from '../../../agents';
import { AgentStateData, AgentConnectionData, AgentPreviewResponse } from './types';
import { ApiResponse, ControllerResponse } from '../BaseController.types';
import { RouteContext } from '../../types/route-context';
import { AppService, DatabaseService, ModelConfigService } from '../../../database';
import { ModelConfig } from '../../../agents/inferutils/config.types';
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
 * CodingAgentController to handle all code generation related endpoints
 */
export class CodingAgentController extends BaseController {
    private codeGenLogger: StructuredLogger;

    constructor() {
        super();
        this.codeGenLogger = createObjectLogger(this, 'SimpleCodeGenController');
    }

    /**
     * Start the incremental code generation process
     */
    async startCodeGeneration(request: Request, env: Env, _: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            this.codeGenLogger.info('Starting code generation process', {
                endpoint: '/api/agent'
            });

            const url = new URL(request.url);
            const hostname = url.hostname === 'localhost' ? `localhost:${url.port}`: url.hostname;
            // Parse the query from the request body
            let body: CodeGenArgs;
            try {
                body = await request.json() as CodeGenArgs;
            } catch (error) {
                return this.createErrorResponse(`Invalid JSON in request body: ${JSON.stringify(error, null, 2)}`, 400);
            }

            const query = body.query;
            if (!query) {
                return this.createErrorResponse('Missing "query" field in request body', 400);
            }
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
            // Check if user is authenticated (required for app creation)
            const user = this.extractAuthUser(context);
            if (!user) {
                return new Response(JSON.stringify({ error: 'Authentication required to create apps' }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            const agentId = generateId();
            const db = new DatabaseService(env);
            const modelConfigService = new ModelConfigService(db);
                                
            // Fetch all user model configs, api keys and agent instance at once
            const [userConfigsRecord, agentInstance] = await Promise.all([
                modelConfigService.getUserModelConfigs(user.id),
                getAgentStub(env, agentId, false, this.codeGenLogger)
            ]);
                                
            // Convert Record to Map and extract only ModelConfig properties
            const userModelConfigs = new Map();
            for (const [actionKey, mergedConfig] of Object.entries(userConfigsRecord)) {
                if (mergedConfig.isUserOverride) {
                    const modelConfig: ModelConfig = {
                        name: mergedConfig.name,
                        max_tokens: mergedConfig.max_tokens,
                        temperature: mergedConfig.temperature,
                        reasoning_effort: mergedConfig.reasoning_effort,
                        fallbackModel: mergedConfig.fallbackModel
                    };
                    userModelConfigs.set(actionKey, modelConfig);
                }
            }

            const inferenceContext = {
                userModelConfigs: Object.fromEntries(userModelConfigs),
                agentId: agentId,
                userId: user.id,
                enableRealtimeCodeFix: true, // For now disabled from the model configs itself
            }
                                
            this.logger.info(`Initialized inference context for user ${user.id}`, {
                modelConfigsCount: Object.keys(userModelConfigs).length,
            });

            const agentPromise = agentInstance.initialize({
                query,
                language: body.language || defaultCodeGenArgs.language,
                frameworks: body.frameworks || defaultCodeGenArgs.frameworks,
                hostname,
                inferenceContext,
                onTemplateGenerated: (templateDetails) => {
                    const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/agent/${agentId}/ws`;
                    const httpStatusUrl = `${url.origin}/api/agent/${agentId}`;
                
                    writer.write({
                        message: 'Code generation started',
                        agentId: agentId, // Keep as agentId for backward compatibility
                        websocketUrl,
                        httpStatusUrl,
                        template: {
                            name: templateDetails.name,
                            files: templateDetails.files,
                        }
                    });
                },
                onBlueprintChunk: (chunk) => {
                    writer.write({ chunk });
                },
            }, body.agentMode || defaultCodeGenArgs.agentMode) as Promise<CodeGenState>;
            agentPromise.then(async (state: CodeGenState) => {
                this.codeGenLogger.info('Blueprint generated successfully');
                // Save the app to database (authenticated users only)
                const appService = new AppService(this.createDbService(env));
                await appService.createApp({
                    id: agentId,
                    userId: user.id,
                    sessionToken: null,
                    title: state.blueprint.title || query.substring(0, 100),
                    description: state.blueprint.description || null,
                    originalPrompt: query,
                    finalPrompt: query,
                    blueprint: state.blueprint,
                    framework: state.blueprint.frameworks?.[0] || defaultCodeGenArgs.frameworks?.[0],
                    visibility: 'private',
                    status: 'generating',
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                this.codeGenLogger.info('App saved successfully to database', { 
                    agentId, 
                    userId: user.id,
                    visibility: 'private'
                });
                this.codeGenLogger.info('Agent initialized successfully');
            }).finally(() => {
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
     * Handle WebSocket connections for code generation
     * This routes the WebSocket connection directly to the Agent
     */
    async handleWebSocketConnection(
        request: Request,
        env: Env,
        _: ExecutionContext,
        context: RouteContext
    ): Promise<Response> {
        try {
            const chatId = context.pathParams.agentId; // URL param is still agentId for backward compatibility
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
                const agentInstance = await getAgentStub(env, chatId, true, this.codeGenLogger);
                
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

    /**
     * Connect to an existing agent instance
     * Returns connection information for an already created agent
     */
    async connectToExistingAgent(
        request: Request,
        env: Env,
        _: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<AgentConnectionData>>> {
        try {
            const agentId = context.pathParams.agentId;
            if (!agentId) {
                return this.createErrorResponse<AgentConnectionData>('Missing agent ID parameter', 400);
            }

            this.codeGenLogger.info(`Connecting to existing agent: ${agentId}`);

            try {
                // Verify the agent instance exists
                const agentInstance = await getAgentStub(env, agentId, true, this.codeGenLogger);
                if (!agentInstance || !(await agentInstance.isInitialized())) {
                    return this.createErrorResponse<AgentConnectionData>('Agent instance not found or not initialized', 404);
                }
                this.codeGenLogger.info(`Successfully connected to existing agent: ${agentId}`);

                // Construct WebSocket URL
                const url = new URL(request.url);
                const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/agent/${agentId}/ws`;

                const responseData: AgentConnectionData = {
                    websocketUrl,
                    agentId,
                };

                return this.createSuccessResponse(responseData);
            } catch (error) {
                this.codeGenLogger.error(`Failed to connect to agent ${agentId}:`, error);
                return this.createErrorResponse<AgentConnectionData>(`Agent instance not found or unavailable: ${error instanceof Error ? error.message : String(error)}`, 404);
            }
        } catch (error) {
            this.codeGenLogger.error('Error connecting to existing agent', error);
            return this.handleError(error, 'connect to existing agent') as ControllerResponse<ApiResponse<AgentConnectionData>>;
        }
    }
    /**
     * Get comprehensive agent state for app viewing
     * Returns strictly typed response matching AgentStateData interface
     */
    async getAgentState(
        request: Request, 
        env: Env, 
        _ctx: ExecutionContext, 
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<AgentStateData>>> {
        try {
            const agentId = context.pathParams.agentId;
            if (!agentId) {
                return this.createErrorResponse<AgentStateData>('Missing agent ID parameter', 400);
            }

            this.codeGenLogger.info(`Fetching agent state: ${agentId}`);

            try {
                // Get the agent instance
                const agentInstance = await getAgentStub(env, agentId, true, this.codeGenLogger);
                
                // Get the full agent state to access conversation messages and other details
                const fullState = await agentInstance.getFullState() as CodeGenState;
                this.logger.info('Agent state fetched successfully', {
                    agentId,
                    // state: fullState,
                });
                // Construct WebSocket URL
                const url = new URL(request.url);
                const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/api/agent/${agentId}/ws`;
                
                // Prepare response with comprehensive agent data matching AgentStateData interface
                const responseData: AgentStateData = {
                    agentId,
                    websocketUrl,
                    state: fullState,
                };

                this.codeGenLogger.info('Agent state fetched successfully', {
                    agentId,
                    codeFiles: responseData.state.generatedFilesMap.length,
                    conversationMessages: responseData.state.conversationMessages.length,
                    phases: responseData.state.generatedPhases.length
                });

                return this.createSuccessResponse(responseData);

            } catch (agentError) {
                this.codeGenLogger.error('Failed to fetch agent instance', { agentId, error: agentError });
                return this.createErrorResponse<AgentStateData>('Agent instance not found or inaccessible', 404);
            }

        } catch (error) {
            this.codeGenLogger.error('Error fetching agent state', error);
            // Use the typed error handling approach
            const appError = this.handleError(error, 'fetch agent state') as ControllerResponse<ApiResponse<AgentStateData>>;
            return appError;
        }
    }

    async deployPreview(
        _request: Request,
        env: Env,
        _: ExecutionContext,
        context: RouteContext
    ): Promise<ControllerResponse<ApiResponse<AgentPreviewResponse>>> {
        try {
            const agentId = context.pathParams.agentId;
            if (!agentId) {
                return this.createErrorResponse<AgentPreviewResponse>('Missing agent ID parameter', 400);
            }

            this.codeGenLogger.info(`Deploying preview for agent: ${agentId}`);

            try {
                // Get the agent instance
                const agentInstance = await getAgentStub(env, agentId, true, this.codeGenLogger);
                
                // Deploy the preview
                const preview = await agentInstance.deployToSandbox();
                if (!preview) {
                    return this.createErrorResponse<AgentPreviewResponse>('Failed to deploy preview', 500);
                }
                this.codeGenLogger.info('Preview deployed successfully', {
                    agentId,
                    previewUrl: preview.previewURL
                });

                return this.createSuccessResponse(preview);
            } catch (error) {
                this.codeGenLogger.error('Failed to deploy preview', { agentId, error });
                return this.createErrorResponse<AgentPreviewResponse>('Failed to deploy preview', 500);
            }
        } catch (error) {
            this.codeGenLogger.error('Error deploying preview', error);
            const appError = this.handleError(error, 'deploy preview') as ControllerResponse<ApiResponse<AgentPreviewResponse>>;
            return appError;
        }
    }
}