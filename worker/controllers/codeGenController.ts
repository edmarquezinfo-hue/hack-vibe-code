import { createLogger } from '../utils/logger';
import { badRequestResponse, errorResponse, successResponse } from '../utils/responses';
import { generateBlueprint } from '../codegen/blueprint';
import { CodeGeneratorAgent, WebSocketMessageTypes } from '../codegen/codeGenerator';
import { getAgentByName } from 'agents';
import { selectTemplate } from '../codegen/templateSelector';
import { TemplateDetailsResponse } from '../codegen/runnerServiceTypes';
import { RunnerServiceClient } from '../codegen/runnerServiceUtils';

const logger = createLogger('CodeGenController');

interface CodeGenArgs {
    query: string;
    language?: string;
    frameworks?: string[];
    selectedTemplate?: string;
}

const defaultCodeGenArgs: CodeGenArgs = {
    query: '',
    language: 'typescript',
    frameworks: ['react', 'vite'],
    selectedTemplate: 'auto',
};

/**
 * CodeGenController to handle all code generation related endpoints
 */
export class CodeGenController {

    /**
     * Start the incremental code generation process
     */
    async startCodeGeneration(request: Request, env: Env): Promise<Response> {
        try {
            // Parse the query from the request body
            let body: CodeGenArgs;
            try {
                body = await request.json() as CodeGenArgs;
            } catch  {
                return badRequestResponse('Invalid JSON in request body');
            }

            const query = body.query;
            if (!query) {
                return badRequestResponse('Missing "query" field in request body');
            }

            let language = body.language || defaultCodeGenArgs.language;
            let frameworks = body.frameworks || defaultCodeGenArgs.frameworks;
            let selectedTemplate: TemplateDetailsResponse | undefined;
            RunnerServiceClient.init(env.RUNNER_SERVICE_URL);

            // If no template is selected, fetch available templates
            const templatesResponse = await RunnerServiceClient.listTemplates();
            if (!templatesResponse) {
                return errorResponse('Failed to fetch templates from runner service', 500, 'Templates not available');
            }

            const analyzeQueryResponse = await selectTemplate({
                env,
                query,
                availableTemplates: templatesResponse.templates,
            });

            logger.info('Selected template:', JSON.stringify(analyzeQueryResponse, null, 2));

            // Find the selected template by name in the available templates
            if (analyzeQueryResponse.selectedTemplateName) {
                const resp = await RunnerServiceClient.getTemplateDetails(analyzeQueryResponse.selectedTemplateName);
                if (resp && resp.success && resp.templateDetails) {
                    selectedTemplate = resp;
                    language = selectedTemplate.templateDetails?.language || language;
                    frameworks = selectedTemplate.templateDetails?.frameworks || frameworks;
                } else {
                    logger.warn(`Selected template ${analyzeQueryResponse.selectedTemplateName} not found or error: ${resp?.error || 'Unknown error'}`);
                }
            }



            if (!selectedTemplate || !selectedTemplate.templateDetails) {
                logger.error('No suitable template found for code generation');
                return errorResponse('No suitable template found for code generation', 404, 'Template not selected');
            }

            // Generate a blueprint
            logger.info('Generating blueprint for:', query);
            logger.info(`Using language: ${language}, frameworks: ${frameworks ? frameworks.join(", ") : "none"}`);

            // Create a new agent instance with a generated ID
            const agentId = crypto.randomUUID();
            const agentInstance = await getAgentByName<Env, CodeGeneratorAgent>(env.CodeGenObject, agentId);

            logger.info(`Created new agent instance with ID: ${agentId}`);

            // Construct the response URLs
            const url = new URL(request.url);
            const websocketUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}/codegen/ws/${agentId}`;
            const httpStatusUrl = `${url.origin}/codegen/incremental/${agentId}`;

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
                agentId,
                websocketUrl,
                httpStatusUrl,
                template: {
                    name: selectedTemplate.templateDetails.name,
                    files: selectedTemplate.templateDetails.files,
                }
            });

            generateBlueprint({
                env,
                query,
                language: language!,
                frameworks: frameworks!,
                selectedTemplate: selectedTemplate.templateDetails,
                analyzeQueryResponse,
                onChunk: (chunk) => {
                    writer.write({ chunk });
                }
            }).then(async (blueprint) => {
                logger.info('Blueprint generated successfully');
                // Initialize the agent with the blueprint and query
                await agentInstance.initialize(query, blueprint, selectedTemplate.templateDetails!);
                logger.info('Agent initialized successfully');
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
            logger.error('Error starting code generation', error);
            return errorResponse(error instanceof Error ? error : String(error), 500, 'Failed to start code generation process');
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
            const agentId = params?.agentId;
            if (!agentId) {
                return badRequestResponse('Missing agent ID parameter');
            }

            logger.info(`Getting code generation progress for agent: ${agentId}`);

            // Get the agent instance and its current state
            const agentInstance = await getAgentByName<Env, CodeGeneratorAgent>(env.CodeGenObject, agentId);
            const codeProgress = await agentInstance.getProgress();

            logger.info('Retrieved code generation progress successfully');

            return successResponse({
                text_explanation: codeProgress.text_explaination,
                generated_code: codeProgress.generated_code,
                progress: {
                    completedFiles: codeProgress.generated_code.length,
                    totalFiles: codeProgress.total_files || 'unknown'
                }
            });
        } catch (error) {
            logger.error('Error getting code generation progress', error);
            return errorResponse(error instanceof Error ? error : String(error), 500, 'Failed to get code generation progress');
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
            const agentId = params?.agentId;
            if (!agentId) {
                return badRequestResponse('Missing agent ID parameter');
            }

            // Ensure the request is a WebSocket upgrade request
            if (request.headers.get('Upgrade') !== 'websocket') {
                return new Response('Expected WebSocket upgrade', { status: 426 });
            }

            logger.info(`WebSocket connection request for agent: ${agentId}`);

            try {
                // Get the agent instance to handle the WebSocket connection
                const agentInstance = await getAgentByName<Env, CodeGeneratorAgent>(env.CodeGenObject, agentId);

                // Let the agent handle the WebSocket connection directly
                return agentInstance.fetch(request);
            } catch (error) {
                logger.error(`Failed to get agent instance with ID ${agentId}:`, error);
                // Return an appropriate WebSocket error response
                // We need to emulate a WebSocket response even for errors
                const { 0: client, 1: server } = new WebSocketPair();

                server.accept();
                server.send(JSON.stringify({
                    type: WebSocketMessageTypes.ERROR,
                    error: `Failed to get agent instance: ${error instanceof Error ? error.message : String(error)}`
                }));

                server.close(1011, 'Agent instance not found');

                return new Response(null, {
                    status: 101,
                    webSocket: client
                });
            }
        } catch (error) {
            logger.error('Error handling WebSocket connection', error);
            return errorResponse(error instanceof Error ? error : String(error), 500, 'Failed to establish WebSocket connection');
        }
    }
}