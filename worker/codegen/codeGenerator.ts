import z from 'zod';
import { AIModels, Message } from './aigateway';
import { Blueprint } from './blueprint';
import { Agent, Connection } from 'agents';
import { USER_PROMPT_FORMATTER } from './prompts';
import { createUserMessage, cleanFileMetadata, CodeEditStreamer } from './utils';
import { executeInferenceSchema, createFileGenerationRequestMessage, createFileGenerationResponseMessage, createCodeGenerationSystemMessage, createCodeReviewRequestSystemtMessage, executeInference, createUpdateProjectRequestSystemMessage } from './inferenceUtils';
import type { TemplateDetailsResponse, RuntimeError, WriteFilesRequest, StaticAnalysisResponse } from './runnerServiceTypes';
import { RunnerServiceClient } from './runnerServiceUtils';
import { createLogger } from '../utils/logger';

// WebSocket message types
export const WebSocketMessageTypes = {
    FILE_GENERATING: 'file_generating',
    FILE_CHUNK_GENERATED: 'file_chunk_generated',
    FILE_GENERATED: 'file_generated',
    GENERATION_STARTED: 'generation_started',
    GENERATION_COMPLETE: 'generation_complete',
    GENERATE_ALL: 'generate_all',
    GENERATE_NEXT: 'generate_next',
    ERROR: 'error',
    CODE_REVIEW: 'code_review',
    RUNTIME_ERROR_FOUND: 'runtime_error_found',
    FILE_REGENERATED: 'file_regenerated',
    DEPLOYMENT_COMPLETED: 'deployment_completed',
    GENERATION_ERRORS: 'generation_errors',
    CODE_FIX_EDITS: 'code_fix_edits',
    UPDATE_QUERY: 'update_query',
};

/**
 * Schema for code generation output
 */
export const CodeOutput = z.object({
    text_explaination: z.string().describe('A detailed explanation of the generated code'),
    generated_code: z.array(z.object({
        file_path: z.string().describe('The name of the file including path'),
        file_contents: z.string().describe('The complete contents of the file'),
    })),
    total_files: z.number().optional().describe('Total number of files to be generated')
});

/**
 * Schema for file generation output
 */
export const FileGenerationOutput = z.object({
    file_path: z.string().describe('The name of the file including path'),
    // thinking_area: z.string().describe('Planning/Thinking area for designing and developing the code in this file'),
    file_contents: z.string().describe('The complete contents of the file'),
    explanation: z.string().describe('Concise, to the point explanation of this file\'s purpose and how it fits into the project'),
});

/**
 * Schema for code review output
 */
export const CodeReviewOutput = z.object({
    thinking_process: z.string().describe('The thought process while reviewing the code.'),
    issues_found: z.boolean().describe('Whether any issues were found in the code review'),
    // integration_issues: z.array(z.string()).describe('Issues related to integration between components'),
    summary: z.string().describe('Detailed summary of the issues found in the code review'),
    files_to_fix: z.array(z.object({
        file_path: z.string().describe('Path to the file that needs fixing'),
        issues: z.array(z.string()).describe('List of issues found in this file and recommendations for fixing them'),
        // recommendation: z.string().describe('Recommendation for how to fix the issue')
    })).describe('List of files that need to be fixed'),
});

export type CodeOutputType = z.infer<typeof CodeOutput>;
export type FileGenerationOutputType = z.infer<typeof FileGenerationOutput>;
export type CodeReviewOutputType = z.infer<typeof CodeReviewOutput>;

/**
 * Agent state definition for code generation
 */
export interface CodeGenState {
    blueprint: Blueprint;
    query: string;
    generatedFilesMap: Record<string, FileGenerationOutputType>;
    generationPromise?: Promise<void>;
    generatedFiles: string[];       // Ordered list of generated files
    // history: Message[];
    isGenerating: boolean;
    templateDetails?: TemplateDetailsResponse['templateDetails'];
    runtimeErrors: RuntimeError[];
    runnerInstanceId?: string;
    previewURL?: string;
    tunnelURL?: string;
    lastCodeReview?: CodeReviewOutputType;
}

const logger = createLogger('CodeGenerator');

async function createNewDeployment(
    {
        blueprint,
        templateDetails
    }
        : {
            blueprint: Blueprint;
            templateDetails: Exclude<TemplateDetailsResponse['templateDetails'], undefined>;
        }): Promise<{ runnerInstanceId: string, previewURL: string, tunnelURL?: string }> {

    logger.info("Creating new runner instance...");
    const templateName = templateDetails.name;
    logger.info(`Using template: ${templateName}`);

    const createResponse = await RunnerServiceClient.createInstance(templateName);
    if (!createResponse || !createResponse.success || !createResponse.runId) {
        throw new Error(`Failed to create runner instance: ${createResponse?.error || 'Unknown error'}`);
    }

    const runnerInstanceId = createResponse.runId;
    const previewURL = createResponse.previewURL || '';
    const tunnelURL = createResponse.tunnelURL || undefined;

    // Run the commands listed in the blueprint
    const commands = blueprint.commands.setup;
    if (commands && commands.length > 0) {
        logger.info(`Running setup commands: ${commands.join(', ')}`);
        const runCommandsResponse = await RunnerServiceClient.executeCommands(runnerInstanceId, commands);
        if (!runCommandsResponse || !runCommandsResponse.success) {
            throw new Error(`Failed to run setup commands: ${runCommandsResponse?.error || 'Unknown error'}`);
        }
    }

    return { runnerInstanceId, previewURL, tunnelURL };
}

/**
 * CodeGeneratorAgent: An agent for generating code incrementally file by file
 * based on a blueprint, with tools for template matching and documentation
 */
export class CodeGeneratorAgent extends Agent<Env, CodeGenState> {
    // Define default initial state for the agent
    initialState: CodeGenState = {
        blueprint: {} as Blueprint,
        query: "",
        generatedFilesMap: {},
        generationPromise: undefined,
        generatedFiles: [],
        isGenerating: false,
        runtimeErrors: [],
        lastCodeReview: undefined,
        runnerInstanceId: undefined,
        previewURL: undefined,
        templateDetails: undefined,
    };

    getTotalFiles(): number {
        return Math.max(this.state.blueprint.fileStructure?.length || 0, Object.keys(this.state.generatedFilesMap).length);
    }

    /**
     * Handle an incoming WebSocket message
     */
    async onMessage(connection: Connection, message: string): Promise<void> {
        try {
            logger.info(`Received WebSocket message from ${connection.id}: ${message}`);

            const parsedMessage = JSON.parse(message);

            switch (parsedMessage.type) {
                case WebSocketMessageTypes.GENERATE_ALL: {
                    if (this.state.isGenerating) {
                        this.sendError(connection, 'Already generating files');
                        return;
                    }

                    try {
                        await this.generateAllFiles();
                    } catch (error) {
                        logger.error('Error generating files:', error);
                        this.sendError(connection, `Error generating files: ${error instanceof Error ? error.message : String(error)}`);
                    } finally {
                        this.setState({ ...this.state, isGenerating: false });
                    }
                    break;
                }
                case WebSocketMessageTypes.GENERATE_NEXT: {
                    if (this.state.isGenerating) {
                        this.sendError(connection, 'Already generating files');
                        return;
                    }

                    const nextFile = this.getNextFileToGenerateFromBlueprint();
                    if (!nextFile) {
                        this.sendError(connection, 'No more files to generate');
                        return;
                    }

                    this.setState({ ...this.state, isGenerating: true });

                    try {
                        await this.generateFile(nextFile);
                    } catch (error) {
                        logger.error(`Error generating file ${nextFile.path}:`, error);
                        this.sendError(connection, `Error generating file: ${error instanceof Error ? error.message : String(error)}`);
                    } finally {
                        this.setState({ ...this.state, isGenerating: false });
                    }
                    break;
                }
                case WebSocketMessageTypes.CODE_REVIEW: {
                    if (this.state.isGenerating) {
                        this.sendError(connection, 'Cannot perform code review while generating files');
                        return;
                    }

                    this.sendToConnection(connection, WebSocketMessageTypes.CODE_REVIEW, {
                        message: 'Starting code review'
                    });

                    try {
                        await this.reviewCode();
                    } catch (error) {
                        logger.error('Error during code review:', error);
                        this.sendError(connection, `Error during code review: ${error instanceof Error ? error.message : String(error)}`);
                    }
                    break;
                }
                case WebSocketMessageTypes.UPDATE_QUERY: {
                    const newQuery = parsedMessage.query as string;
                    await this.updateQuery(newQuery);
                    break;
                }
                default:
                    this.sendError(connection, `Unknown message type: ${parsedMessage.type}`);
            }
        } catch (error) {
            logger.error('Error processing WebSocket message:', error);
            this.sendError(connection, `Error processing message: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle WebSocket connection closures
     */
    async onClose(connection: Connection): Promise<void> {
        logger.info(`WebSocket connection closed: ${connection.id}`);
    }

    /**
     * Send a message to all connected clients
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public broadcast(type: string, data: any): void {
        const connections = this.ctx.getWebSockets();
        logger.info(`Broadcasting message to ${connections.length} connections`);

        for (const connection of connections) {
            try {
                this.sendToConnection(connection, type, data);
            } catch (error) {
                logger.error(`Error sending message to connection ${connection.url}:`, error);
            }
        }
    }

    /**
     * Send a message to a specific connection
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private sendToConnection(connection: WebSocket, type: string, data: any): void {
        try {
            connection.send(JSON.stringify({
                type,
                ...data
            }));
        } catch (error) {
            logger.error(`Error sending message to connection ${connection.url}:`, error);
        }
    }

    /**
     * Send an error message to a connection
     */
    private sendError(connection: Connection, errorMessage: string): void {
        this.sendToConnection(connection, WebSocketMessageTypes.ERROR, { error: errorMessage });
    }

    async initialize(
        query: string,
        blueprint: Blueprint,
        templateDetails: Exclude<TemplateDetailsResponse['templateDetails'], undefined>,
    ): Promise<void> {
        logger.info("Initializing CodeGeneratorAgent with query and blueprint");

        RunnerServiceClient.init(this.env.RUNNER_SERVICE_URL);

        this.setState({
            ...this.initialState,
            query,
            blueprint,
            templateDetails,
            generatedFilesMap: {},
            runtimeErrors: [],
            lastCodeReview: undefined,
            runnerInstanceId: undefined,
            previewURL: undefined,
            tunnelURL: undefined,
            isGenerating: false,
        });

        // Initiate an early deployment in parallel to the generation process
        createNewDeployment({
            blueprint,
            templateDetails
        }).then(({ runnerInstanceId, previewURL, tunnelURL }) => {
            logger.info(`Created new runner instance: ${runnerInstanceId} with preview URL: ${previewURL}`);
            this.setState({
                ...this.state,
                runnerInstanceId,
                previewURL,
                tunnelURL
            });
            // Do not yet send the preview URL to the client
        }).catch(error => {
            logger.error("Error creating new runner instance:", error);
            this.broadcast(WebSocketMessageTypes.ERROR, { error: `Failed to create new runner instance: ${error instanceof Error ? error.message : String(error)}` });
        });

        logger.info("Agent initialized successfully");
    }

    getGenerationContext(): Message[] {
        const { query, blueprint, templateDetails } = this.state;

        const systemMessage = createCodeGenerationSystemMessage(
            query,
            blueprint,
            templateDetails
        );

        const messages: Message[] = [systemMessage];

        // For each generated file, add its contents to the context
        this.state.generatedFiles.forEach(filePath => {
            const file = this.state.generatedFilesMap[filePath];
            if (file) {
                messages.push(createFileGenerationResponseMessage(file.file_path, file.file_contents, file.explanation));
            } else {
                logger.warn(`File ${filePath} not found in generated files map`);
            }
        });

        logger.info(`Total messages generated: ${messages.length}`);

        return messages;
    }

    /**
     * Fetch the current progress of the code generation
     */
    async getProgress(): Promise<CodeOutputType> {
        const generatedFiles = Object.keys(this.state.generatedFilesMap);
        const totalFiles = this.getTotalFiles();
        const summary = `Generated ${generatedFiles.length} out of ${totalFiles} files so far.`;

        return {
            text_explaination: summary,
            generated_code: Object.values(this.state.generatedFilesMap).map(file => ({
                file_path: file.file_path,
                file_contents: file.file_contents
            })),
            total_files: totalFiles
        };
    }

    async waitForGeneration(): Promise<void> {
        if (this.state.generationPromise) {
            try {
                await this.state.generationPromise;
                logger.info("Code generation completed successfully");
            } catch (error) {
                logger.error("Error during code generation:", error);
            }
        } else {
            logger.error("No generation process found");
        }
    }

    /**
     * Fetch runtime errors from the runner service
     */
    async fetchRuntimeErrors(): Promise<RuntimeError[]> {
        const { runnerInstanceId } = this.state;

        if (!runnerInstanceId) {
            logger.warn("No runner instance ID available to fetch errors from.");
            if (this.state.runtimeErrors.length > 0) {
                this.setState({ ...this.state, runtimeErrors: [] });
            }
            return [];
        }

        try {
            logger.info(`Fetching runtime errors from runner service instance ${runnerInstanceId}`);

            const resp = await RunnerServiceClient.getInstanceErrors(runnerInstanceId);
            if (!resp || !resp.success) {
                logger.error(`Failed to fetch runtime errors: ${resp?.error || 'Unknown error'}`);
                if (this.state.runtimeErrors.length > 0) {
                    this.setState({ ...this.state, runtimeErrors: [] });
                }
                return [];
            }

            const errors = resp.errors || [];

            this.setState({
                ...this.state,
                runtimeErrors: errors
            });

            if (errors.length > 0) {
                logger.info(`Found ${errors.length} runtime errors`);
                this.broadcast(WebSocketMessageTypes.RUNTIME_ERROR_FOUND, {
                    errors,
                    count: errors.length
                });
            } else {
                logger.info("No runtime errors found.");
            }

            return errors;
        } catch (error) {
            logger.error("Exception fetching runtime errors:", error);
            if (this.state.runtimeErrors.length > 0) {
                this.setState({ ...this.state, runtimeErrors: [] });
            }
            return [];
        }
    }

    /**
     * Deploy code to runner service for testing
     */
    async deployToRunnerService(): Promise<string | null> {
        const { blueprint, templateDetails, generatedFilesMap } = this.state;
        let { runnerInstanceId, previewURL, tunnelURL } = this.state;

        if (!templateDetails) {
            logger.error("RunnerServiceClient not available for deployment.");
            this.broadcast(WebSocketMessageTypes.ERROR, { error: "Runner service client not configured." });
            return null;
        }

        logger.info("Deploying code to runner service");

        try {
            if (!runnerInstanceId) {
                const {
                    runnerInstanceId: newRunnerInstanceId,
                    previewURL: newPreviewURL,
                    tunnelURL: newTunnelURL,
                } = await createNewDeployment({
                    blueprint,
                    templateDetails
                });

                runnerInstanceId = newRunnerInstanceId;
                previewURL = newPreviewURL;
                tunnelURL = newTunnelURL

                this.setState({
                    ...this.state,
                    runnerInstanceId,
                    previewURL,
                    tunnelURL
                });


                logger.info(`Created instance ${runnerInstanceId} with preview URL: ${previewURL}`);
            } else {
                logger.info(`Using existing runner instance: ${runnerInstanceId}`);
            }

            const filesToWrite: WriteFilesRequest['files'] = Object.values(generatedFilesMap).map(file => ({
                file_path: file.file_path,
                file_contents: file.file_contents
            }));

            if (filesToWrite.length === 0) {
                logger.warn("No files generated yet, skipping file writing.");
            } else {
                logger.info(`Writing ${filesToWrite.length} files to runner instance ${runnerInstanceId}`);

                const writeResponse = await RunnerServiceClient.writeFiles(runnerInstanceId, filesToWrite);
                if (!writeResponse || !writeResponse.success) {
                    const failedFiles = writeResponse?.results?.filter(r => !r.success) || [];
                    logger.warn(`File writing failed for ${failedFiles.length} files. Error: ${writeResponse?.error}`);
                    if (failedFiles.length > 0) {
                        logger.warn(`Failed files: ${JSON.stringify(failedFiles)}`);
                    }
                    this.broadcast(WebSocketMessageTypes.ERROR, { error: `Failed to write some files to the runner: ${writeResponse?.error}` });
                } else {
                    const successCount = writeResponse.results?.filter(r => r.success).length ?? 0;
                    const totalCount = writeResponse.results?.length ?? filesToWrite.length;
                    logger.info(`Successfully wrote ${successCount}/${totalCount} files`);
                }
            }

            logger.info("Checking for runtime errors after deployment.");
            await this.fetchRuntimeErrors();


            this.broadcast(WebSocketMessageTypes.DEPLOYMENT_COMPLETED, {
                message: "Deployment completed",
                previewURL: previewURL,
                tunnelURL: tunnelURL,
                instanceId: runnerInstanceId
            });
            logger.info("Deployment process completed.");

            return runnerInstanceId;
        } catch (error) {
            logger.error("Error deploying to runner service, would reset instance and retry:", error);
            this.setState({
                ...this.state,
                runnerInstanceId: undefined,
                previewURL: undefined
            });

            return this.deployToRunnerService();
        }
    }

    /**
     * Perform a comprehensive code review of all generated files
     */
    async reviewCode() {
        try {
            // First run linting to catch common issues
            logger.info("Running static code analysis via linting...");
            const results = await this.runStaticAnalysisCode();
            const lintResults = results?.lint;
            const typeErrors = results?.typecheck;

            // Fetch runtime errors
            const errors = await this.fetchRuntimeErrors();

            this.broadcast(WebSocketMessageTypes.GENERATION_ERRORS, {
                typeErrors: typeErrors?.issues.length || 0,
                lintIssues: lintResults?.issues.length || 0,
                runtimeErrors: errors
            });

            if (errors.length === 0 && (!lintResults?.issues || lintResults.issues.length === 0) && (!typeErrors || typeErrors.issues.length === 0)) {
                logger.info("No issues found during code review.");
                return;
            }

            if (errors.length >= 0) {
                logger.info(`Found ${errors.length} runtime errors, will include in code review: ${errors.map(e => e.message).join(', ')}`);
            }

            const filesSummary = Object.values(this.state.generatedFilesMap).map(file => ({
                file_name: file.file_path,
                file_contents: file.file_contents
            }));

            // Include lint issues in the review context
            let lintContext = '';

            if (lintResults && lintResults.issues.length > 0) {
                lintContext = `
<LINT RESULTS>
Found ${lintResults.issues.length} potential issues via linting:
${lintResults.issues.map(issue => `- ${issue.severity.toUpperCase()} in ${issue.filePath} (line ${issue.line}${issue.column ? `, column ${issue.column}` : ''}): ${issue.message}${issue.ruleId ? ` [${issue.ruleId}]` : ''}`).join('\n')}
</LINT RESULTS>
`;
                logger.info(`Adding ${lintResults.issues.length} linting issues to code review context`);
            }


            if (typeErrors && typeErrors.issues.length > 0) {
                lintContext += `
<TYPECHECK RESULTS>
Found ${typeErrors.issues.length} potential type issues:
${typeErrors.issues.map(issue => `- ${issue.severity.toUpperCase()} in ${issue.filePath} (line ${issue.line}${issue.column ? `, column ${issue.column}` : ''}): ${issue.message}${issue.ruleId ? ` [${issue.ruleId}]` : ''}`).join('\n')}
</TYPECHECK RESULTS>
`;
                logger.info(`Adding ${typeErrors.issues.length} typecheck issues to code review context`);
            }

            const userPrompt = `
${lintContext}
<GENERATED CODE FILES>
${filesSummary.map(file => `
FILE PATH: ${file.file_name}
\`\`\`
${file.file_contents}
\`\`\`

`).join('\n')}
`;


            const messages = [
                createCodeReviewRequestSystemtMessage(
                    this.state.query,
                    this.state.blueprint,
                    this.state.templateDetails,
                    errors,
                ),
                createUserMessage(userPrompt)
            ];

            const generatedFiles = { ...this.state.generatedFilesMap };

            const streamingEdits = new CodeEditStreamer((payload) => {
                const { filePath } = payload;
                if (!generatedFiles[filePath]) {
                    logger.warn(`File ${filePath} not found in generated files map during update query.`);
                    return;
                }
                if (generatedFiles[filePath].file_contents.indexOf(payload.search) === -1) {
                    logger.warn(`Search code "${payload.search}" not found in file ${filePath} contents.`);
                    return;
                }
                generatedFiles[filePath].file_contents = generatedFiles[filePath].file_contents.replace(payload.search, payload.replacement);
                this.broadcast(WebSocketMessageTypes.CODE_FIX_EDITS, payload)
            });
            const reviewResult = await executeInference({
                env: this.env,
                messages,
                maxTokens: 500000,
                operationName: `Code review`,
                modelName: AIModels.GEMINI_2_5_FLASH_PREVIEW_05_20,
                reasoningEffort: "medium",
                onChunk: (chunk: string) => streamingEdits.feed(chunk)
            });

            this.setState({
                ...this.state,
                generatedFilesMap: generatedFiles,
            });
            this.deployToRunnerService();

            if (!reviewResult) {
                throw new Error("Failed to get code review result");
            }
        } catch (error) {
            logger.error("Error during code review:", error);
            return null;
        }
    }

    cleanFileContents(fileContents: string): string {
        // Sometimes the AI generates code with trailing ``` or other artifacts
        // Clean up the file contents if necessary
        let cleanedContents = fileContents;
        if (fileContents.startsWith('```')) {
            // Ignore the first line if it starts with ```
            cleanedContents = fileContents.split('\n').slice(1).join('\n');
        }

        if (cleanedContents.endsWith('```')) {
            // Ignore the last line if it ends with ```
            cleanedContents = cleanedContents.split('\n').slice(0, -1).join('\n');
        }

        return cleanedContents;
    }

    /**
     * Regenerate a file based on runtime errors or code review
     */
    async regenerateFile(filePath: string, filePurpose: string, issueDescription: string): Promise<FileGenerationOutputType | null> {
        try {
            logger.info(`Regenerating file: ${filePath} due to issues: ${issueDescription}`);

            this.broadcast(WebSocketMessageTypes.FILE_GENERATING, {
                file_path: filePath,
                file_purpose: filePurpose,
                is_regeneration: true,
                issue: issueDescription
            });

            const generatedFiles = Object.values(this.state.generatedFilesMap);

            const fileToRegenerate = generatedFiles.find(file => file.file_path === filePath);
            if (!fileToRegenerate) {
                logger.error(`File to regenerate not found: ${filePath}`);
                return null;
            }

            const regenerationPrompt = USER_PROMPT_FORMATTER.CODE_REGENERATION(
                filePath,
                fileToRegenerate.file_contents,
                fileToRegenerate.explanation,
                issueDescription
            );

            const messages = this.getGenerationContext();

            messages.push(createUserMessage(regenerationPrompt));

            const regeneratedFile = await executeInferenceSchema({
                env: this.env,
                messages,
                schema: FileGenerationOutput,
                schemaName: "fileRegeneration",
                maxTokens: 500000,
                operationName: `File regeneration for ${filePath}`,
                modelName: AIModels.GEMINI_2_5_FLASH_PREVIEW_05_20,
                reasoningEffort: "medium",
                retryLimit: 5
            });

            if (!regeneratedFile) {
                logger.error(`Failed to regenerate file: ${filePath}`);
                return null;
            }

            // Clean the file contents if necessary
            const cleanedContents = this.cleanFileContents(regeneratedFile.file_contents);
            regeneratedFile.file_contents = cleanedContents;

            logger.info(`File regenerated successfully: ${filePath}`);

            this.setState({
                ...this.state,
                generatedFilesMap: {
                    ...this.state.generatedFilesMap,
                    [filePath]: regeneratedFile
                },
            });

            this.broadcast(WebSocketMessageTypes.FILE_REGENERATED, {
                file: regeneratedFile,
                original_issues: issueDescription
            });

            return regeneratedFile;
        } catch (error) {
            logger.error(`Error regenerating file ${filePath}:`, error);

            this.broadcast(WebSocketMessageTypes.ERROR, {
                error: `Error regenerating file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
            });

            return null;
        }
    }

    /**
     * Fix runtime errors using the runner service's AI-based fix
     */
    async fixRuntimeErrors(): Promise<boolean> {
        const { runnerInstanceId } = this.state;

        if (!runnerInstanceId) {
            logger.warn("No runner instance ID available to fix errors.");
            this.broadcast(WebSocketMessageTypes.ERROR, { error: "No running instance to fix errors on." });
            return false;
        }

        const errors = await this.fetchRuntimeErrors();
        if (errors.length === 0) {
            logger.info("No runtime errors found to fix.");
            return true;
        }

        logger.info(`Attempting to fix ${errors.length} runtime errors using AI on instance ${runnerInstanceId}`);

        try {
            const fixResponse = await RunnerServiceClient.fixCode(runnerInstanceId);

            if (!fixResponse || !fixResponse.success) {
                const errorMsg = `Code fix failed: ${fixResponse?.error || fixResponse?.message || 'Unknown error'}`;
                logger.error(errorMsg);
                this.broadcast(WebSocketMessageTypes.ERROR, { error: errorMsg });
                return false;
            }

            logger.info(`Code fix attempt completed: ${fixResponse.message || 'Success'}`);

            const fixesApplied = fixResponse.fixes || [];
            if (fixesApplied.length > 0) {
                logger.info(`Applying ${fixesApplied.length} fixes locally.`);
                const updatedFilesMap = { ...this.state.generatedFilesMap };
                let filesUpdatedCount = 0;

                for (const fix of fixesApplied) {
                    if (updatedFilesMap[fix.filePath]) {
                        updatedFilesMap[fix.filePath] = {
                            ...updatedFilesMap[fix.filePath],
                            file_contents: fix.fixedCode,
                            explanation: `${updatedFilesMap[fix.filePath].explanation}\n\n---\nAUTO-FIX APPLIED: ${fix.explanation}`,
                        };
                        filesUpdatedCount++;
                        logger.info(`Updated local file: ${fix.filePath}`);

                        this.broadcast(WebSocketMessageTypes.FILE_REGENERATED, {
                            file: updatedFilesMap[fix.filePath],
                            original_issues: "Runtime error auto-fix",
                            is_auto_fix: true
                        });
                    } else {
                        logger.warn(`File path from fix response not found in local state: ${fix.filePath}`);
                    }
                }

                if (filesUpdatedCount > 0) {
                    this.setState({
                        ...this.state,
                        generatedFilesMap: updatedFilesMap,
                        runtimeErrors: [],
                        lastCodeReview: undefined,
                    });
                    logger.info(`Applied ${filesUpdatedCount} fixes to local state.`);
                } else {
                    logger.info("No applicable fixes found or applied locally.");
                }
            } else {
                logger.info("Runner service reported success but provided no specific file fixes.");
            }

            logger.info("Re-fetching runtime errors after fix attempt.");
            await this.fetchRuntimeErrors();

            return true;
        } catch (error) {
            logger.error("Error fixing runtime errors:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.broadcast(WebSocketMessageTypes.ERROR, { error: `Failed to apply AI fix: ${errorMessage}` });
            return false;
        }
    }

    private getNextFileToGenerateFromBlueprint() {
        const generatedFilePaths = Object.keys(this.state.generatedFilesMap);

        // If we haven't generated any files yet, use the firstFileToGenerate from the blueprint
        if (generatedFilePaths.length === 0 && this.state.blueprint.firstFileToGenerate) {
            const firstFile = this.state.blueprint.fileStructure?.find(file => file.path === this.state.blueprint.firstFileToGenerate);
            if (!firstFile) {
                logger.error("First file to generate not found in blueprint file structure");
                return null;
            }
            return firstFile;
        }

        // Next, check files from the blueprint that haven't been generated yet
        const allFilesInBlueprint = this.state.blueprint.fileStructure || [];
        for (const file of allFilesInBlueprint) {
            if (!generatedFilePaths.includes(file.path)) {
                return file;
            }
        }

        return null;
    }

    addNewFile(file: FileGenerationOutputType): void {
        this.setState({
            ...this.state,
            generatedFilesMap: {
                ...this.state.generatedFilesMap,
                [file.file_path]: file
            },
            generatedFiles: [...this.state.generatedFiles, file.file_path],
        });
        logger.info(`Added new file to generated files: ${file.file_path}`);
    }

    /**
     * Generate the next file based on the blueprint and previously generated files
     */
    async generateFile(file: Blueprint['fileStructure'][0]): Promise<FileGenerationOutputType | null> {
        try {
            logger.info("Generating file:", file.path);

            this.broadcast(WebSocketMessageTypes.FILE_GENERATING, {
                file_path: file.path,
                file_purpose: file.purpose
            });

            const messages = this.getGenerationContext();
            if (!messages || messages.length === 0) {
                logger.error("No messages in history to use for generation");
                return null;
            }

            const userMessage = createFileGenerationRequestMessage(file);
            messages.push(userMessage);

            if(file.complexity === 'complex') {
                logger.info(`Generating complex file: ${file.path}`);
            }

            const generatedFileRaw = await executeInference({
                env: this.env,
                messages,
                maxTokens: 500000,
                operationName: `File generation for ${file.path}`,
                modelName: AIModels.GEMINI_2_5_FLASH_PREVIEW_05_20,
                reasoningEffort: file.complexity === 'complex' ? 'high' : undefined,
                retryLimit: 5,
                onChunk: (chunk: string) => {
                    this.broadcast(WebSocketMessageTypes.FILE_CHUNK_GENERATED, {
                        file_path: file.path,
                        chunk
                    });
                }
            });


            if (!generatedFileRaw || generatedFileRaw.length === 0) {
                logger.error(`Failed to generate file: ${file.path}`);
                return null;
            }

            const generatedFile = {
                file_path: file.path,
                file_contents: this.cleanFileContents(cleanFileMetadata(generatedFileRaw ?? '')),
                explanation: file.purpose,
            }

            logger.info(`File generated successfully: ${file.path}`);

            this.addNewFile(generatedFile);

            this.broadcast(WebSocketMessageTypes.FILE_GENERATED, {
                file: generatedFile,
            });

            logger.info(`Updated state with generated file: ${file.path}`);
            return generatedFile;
        } catch (error) {
            logger.error(`Error generating file ${file.path}:`, error);

            this.broadcast(WebSocketMessageTypes.ERROR, {
                error: `Error generating file ${file.path}: ${error instanceof Error ? error.message : String(error)}`
            });

            return null;
        }
    }

    /**
     * Generate all remaining files in the blueprint
     */
    async generateAllFiles(): Promise<void> {
        this.broadcast(WebSocketMessageTypes.GENERATION_STARTED, {
            message: 'Starting code generation',
            totalFiles: this.getTotalFiles()
        });

        this.setState({ ...this.state, isGenerating: true });

        if (!this.state.blueprint.fileStructure) {
            logger.error("No file structure defined in blueprint");
            this.broadcast(WebSocketMessageTypes.ERROR, { error: "Blueprint missing file structure." });
            return;
        }

        if (this.state.blueprint.fileStructure.length === 0) {
            logger.warn("Blueprint file structure is empty. Nothing to generate.");
            return;
        }

        let nextFile = this.getNextFileToGenerateFromBlueprint();

        if (!nextFile) {
            logger.error("Could not determine the first file to generate.");
            this.broadcast(WebSocketMessageTypes.ERROR, { error: "Cannot determine starting file." });
            return;
        } else {
            logger.info(`Starting generation with firstFileToGenerate from blueprint: ${nextFile.path}`);
        }

        while (nextFile) {
            logger.info(`Generating file: ${nextFile.path}`);
            const generatedFile = await this.generateFile(nextFile);

            if (!generatedFile) {
                logger.error(`Failed to generate file: ${nextFile.path}. Stopping generation.`);
                this.broadcast(WebSocketMessageTypes.ERROR, { error: `Failed to generate ${nextFile.path}. Stopping.` });
                break;
            }
            const nextFromBlueprint = this.getNextFileToGenerateFromBlueprint();
            if (!nextFromBlueprint) break;
            nextFile = nextFromBlueprint;
            logger.info(`Using next file from blueprint: ${nextFile.path}`);
        }

        const numFilesGenerated = Object.keys(this.state.generatedFilesMap).length;
        logger.info(`File generation loop completed. Generated ${numFilesGenerated}/${this.getTotalFiles()} files.`);

        // Check for files from blueprint that weren't generated
        const filesNotGenerated = (this.state.blueprint.fileStructure || [])
            .filter(file => !this.state.generatedFilesMap[file.path])
            .map(file => file.path);

        if (filesNotGenerated.length > 0) {
            logger.warn(`Some files from blueprint were not generated: ${filesNotGenerated.join(", ")}`);
        } else {
            logger.info("All files from blueprint have been generated.");
        }

        // Review and improvement cycle
        logger.info("Starting code review and improvement cycle...");

        try {
            // First deployment to check for runtime errors
            logger.info("Deploying code to runner service for initial check...");
            await this.deployToRunnerService();


            // Initiate code review after 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000));
            logger.info("Starting code review process...");

            // Comprehensive code review
            logger.info("Performing comprehensive code review...");

            await this.reviewCode();
            logger.info("Code generation, review, and deployment cycle finished.");
        } catch (error) {
            logger.error("Error during code review or deployment phase:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.broadcast(WebSocketMessageTypes.ERROR, {
                error: `Error during finalization: ${errorMessage}`
            });
        } finally {
            if (this.state.isGenerating) {
                this.setState({ ...this.state, isGenerating: false });
            }

            this.broadcast(WebSocketMessageTypes.GENERATION_COMPLETE, {
                message: "Code generation and review process completed.",
                instanceId: this.state.runnerInstanceId,
                previewURL: this.state.previewURL,
                tunnelURL: this.state.tunnelURL,
            });
        }
    }

    async updateQuery(query: string): Promise<void> {
        const filesSummary = Object.values(this.state.generatedFilesMap).map(file => ({
            file_name: file.file_path,
            file_contents: file.file_contents
        }));
        const userMessage = `<GENERATED CODE FILES>
${filesSummary.map(file => `
FILE: ${file.file_name}
\`\`\`
${file.file_contents}
\`\`\`
<UPDATED QUERY> ${query}</UPDATED QUERY>
`).join('\n')}
`;
        const messages = [
            createUpdateProjectRequestSystemMessage(
                this.state.query,
                this.state.blueprint,
            ),
            createUserMessage(userMessage)
        ];

        const generatedFiles = { ...this.state.generatedFilesMap };

        const streamingEdits = new CodeEditStreamer((payload) => {
            const { filePath } = payload;
            if (!generatedFiles[filePath]) {
                logger.warn(`File ${filePath} not found in generated files map during update query.`);
                return;
            }
            generatedFiles[filePath].file_contents = generatedFiles[filePath].file_contents.replace(payload.search, payload.replacement);
            this.broadcast(WebSocketMessageTypes.CODE_FIX_EDITS, payload)
        });
        await executeInference({
            env: this.env,
            messages,
            maxTokens: 500000,
            operationName: `Update query`,
            modelName: AIModels.GEMINI_2_5_FLASH_PREVIEW_05_20,
            reasoningEffort: "medium",
            onChunk: (chunk: string) => streamingEdits.feed(chunk)
        });
        this.setState({
            ...this.state,
            generatedFilesMap: generatedFiles,
        });
        await this.deployToRunnerService();
        await this.reviewCode();
    }

    /**
     * Perform static code analysis on the generated files
     * This helps catch potential issues early in the development process
     */
    async runStaticAnalysisCode(): Promise<StaticAnalysisResponse | null> {
        const { runnerInstanceId } = this.state;

        if (!runnerInstanceId) {
            logger.warn("No runner instance ID available to lint code.");
            this.broadcast(WebSocketMessageTypes.ERROR, { error: "No running instance to lint code on." });
            return null;
        }

        logger.info(`Linting code in runner instance ${runnerInstanceId}`);

        const files = this.state.generatedFiles;

        try {
            const analysisResponse = await RunnerServiceClient.runStaticAnalysisCode(runnerInstanceId, files);

            if (!analysisResponse || !analysisResponse.success) {
                const errorMsg = `Code linting failed: ${analysisResponse?.error || 'Unknown error'}`;
                logger.error(errorMsg);
                this.broadcast(WebSocketMessageTypes.ERROR, { error: errorMsg });
                return null;
            }

            const { lint, typecheck } = analysisResponse;
            const { issues: lintIssues, summary: lintSummary } = lint;

            logger.info(`Linting found ${lintIssues.length} issues: ` +
                `${lintSummary?.errorCount || 0} errors, ` +
                `${lintSummary?.warningCount || 0} warnings, ` +
                `${lintSummary?.infoCount || 0} info`);

            const { issues: typeCheckIssues, summary: typeCheckSummary } = typecheck;

            logger.info(`Typecheck found ${typeCheckIssues.length} issues: ` +
                `${typeCheckSummary?.errorCount || 0} errors, ` +
                `${typeCheckSummary?.warningCount || 0} warnings, ` +
                `${typeCheckSummary?.infoCount || 0} info`);

            return analysisResponse;
        } catch (error) {
            logger.error("Error linting code:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.broadcast(WebSocketMessageTypes.ERROR, { error: `Failed to lint code: ${errorMessage}` });
            return null;
        }
    }
}

export class CodeGen extends CodeGeneratorAgent {
    // This class can be extended with additional functionality if needed
}
