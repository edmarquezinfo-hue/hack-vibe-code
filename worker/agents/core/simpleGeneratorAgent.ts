import { Agent, Connection } from 'agents';
import { 
    AgentActionType, 
    Blueprint, 
    CodeOutputType, 
    PhaseConceptGenerationSchemaType, 
    ScreenshotAnalysisType,
    PhaseConceptType,
    FileOutputType,
    TechnicalInstructionType,
    PhaseImplementationSchemaType,
} from '../schemas';
import { GitHubExportRequest, StaticAnalysisResponse, TemplateDetails } from '../../services/sandbox/sandboxTypes';
import { GitHubExportOptions, GitHubExportResult } from '../../types/github';
import { CodeGenState, CurrentDevState } from './state';
import { AllIssues } from './types';
import { WebSocketMessageResponses } from '../constants';
import { broadcastToConnections, handleWebSocketClose, handleWebSocketMessage } from './websocket';
import { createObjectLogger } from '../../logger';
import { ProjectSetupAssistant } from '../assistants/projectsetup';
import { UserConversationProcessor } from '../operations/UserConversationProcessor';
import { UserSuggestionProcessor } from '../operations/UserSuggestionProcessor';
import { executeAction } from './actions';
import { FileManager } from '../services/implementations/FileManager';
import { StateManager } from '../services/implementations/StateManager';
// import { WebSocketBroadcaster } from '../services/implementations/WebSocketBroadcaster';
import { GenerationContext } from '../domain/values/GenerationContext';
import { IssueReport } from '../domain/values/IssueReport';
import { PhaseManagement } from '../domain/pure/PhaseManagement';
import { PhaseImplementationOperation, LAST_PHASE_PROMPT as FINAL_CODE_PHASE_DESCRIPTION } from '../operations/PhaseImplementation';
import { CodeReviewOperation } from '../operations/CodeReview';
import { FileRegenerationOperation } from '../operations/FileRegeneration';
import { PhaseGenerationOperation } from '../operations/PhaseGeneration';
import { ScreenshotAnalysisOperation } from '../operations/ScreenshotAnalysis';
import { ErrorHandler } from './utilities/ErrorHandler';
import { DatabaseOperations } from './utilities/DatabaseOperations';
import { DatabaseService } from '../../database/database';
import * as schema from '../../database/schema';
import { eq } from 'drizzle-orm';
import { BaseSandboxService } from '../../services/sandbox/BaseSandboxService';
import { getSandboxService } from '../../services/sandbox/factory';
import { WebSocketMessageData, WebSocketMessageType } from '../websocketTypes';
import { ConversationMessage } from '../inferutils/common';
import { FileFetcher, fixProjectIssues } from '../../services/code-fixer';
import { FileProcessing } from '../domain/pure/FileProcessing';
import { FastCodeFixerOperation } from '../operations/FastCodeFixer';
import { getProtocolForHost } from '../../utils/urls';
import { looksLikeCommand } from '../utils/common';

interface WebhookPayload {
    event: {
        eventType: 'runtime_error';
        payload: {
            error?: { message: string };
            runId?: string;
            status?: string;
            deploymentType?: string;
            instanceInfo?: unknown;
            command?: string;
        };
        instanceId?: string;
        runId?: string;
        timestamp?: string;
    };
    context: {
        sessionId?: string;
        agentId?: string;
        userId?: string;
    };
    source: string;
}

interface Operations {
    codeReview: CodeReviewOperation;
    regenerateFile: FileRegenerationOperation;
    generateNextPhase: PhaseGenerationOperation;
    analyzeScreenshot: ScreenshotAnalysisOperation;
    implementPhase: PhaseImplementationOperation;
    fastCodeFixer: FastCodeFixerOperation;
    processSuggestions: UserSuggestionProcessor;
    processUserMessage: UserConversationProcessor;
}

/**
 * SimpleCodeGeneratorAgent - Deterministically orhestrated AI-powered code generation
 * 
 * Manages the lifecycle of code generation including:
 * - Blueprint-based phase generation
 * - Real-time file streaming with WebSocket updates
 * - Code validation and error correction
 * - Deployment to sandbox service
 * - Review cycles with automated fixes
 */
export class SimpleCodeGeneratorAgent extends Agent<Env, CodeGenState> {
    protected projectSetupAssistant: ProjectSetupAssistant | undefined;
    protected sandboxServiceClient: BaseSandboxService | undefined;
    protected fileManager: FileManager = new FileManager(
        new StateManager(() => this.state, (s) => this.setState(s)),
    );
    // protected broadcaster: WebSocketBroadcaster = new WebSocketBroadcaster(this);

    protected operations: Operations = {
        codeReview: new CodeReviewOperation(),
        regenerateFile: new FileRegenerationOperation(),
        generateNextPhase: new PhaseGenerationOperation(),
        analyzeScreenshot: new ScreenshotAnalysisOperation(),
        implementPhase: new PhaseImplementationOperation(),
        fastCodeFixer: new FastCodeFixerOperation(),
        processSuggestions: new UserSuggestionProcessor(),
        processUserMessage: new UserConversationProcessor()
    };

    isGenerating: boolean = false;
    
    // Deployment queue management to prevent concurrent deployments
    private currentDeploymentPromise: Promise<string | null> | null = null;
    
    public logger = createObjectLogger(this, 'CodeGeneratorAgent');

    initialState: CodeGenState = {
        blueprint: {} as Blueprint, 
        query: "",
        generatedPhases: [],
        generatedFilesMap: {},
        agentMode: 'deterministic',
        generationPromise: undefined,
        lastCodeReview: undefined,
        sandboxInstanceId: undefined,
        templateDetails: {} as TemplateDetails,
        commandsHistory: [],
        lastPackageJson: '',
        clientReportedErrors: [],
        latestScreenshot: undefined,
        pendingUserInputs: [],
        // conversationalAssistant: new ConversationalAssistant(this.env),
        sessionId: '',
        hostname: '',
        conversationMessages: [],
        currentDevState: CurrentDevState.IDLE,
    };

    /**
     * Initialize the code generator with project blueprint and template
     * Sets up services and begins deployment process
     */
    async initialize(
        query: string,
        blueprint: Blueprint,
        templateDetails: TemplateDetails,
        sessionId: string,
        hostname: string,
        ..._args: unknown[]
    ): Promise<void> {
        this.logger.setFields({
            sessionId,
            blueprintPhases: blueprint.implementationRoadmap?.length || 0,
        });
        
        this.logger.info('Initializing CodeGeneratorAgent with enhanced context', {
            queryLength: query.length,
            blueprintPhases: blueprint.implementationRoadmap?.length || 0,
            templateName: templateDetails?.name
        });

        const packageJsonFile = templateDetails?.files.find(file => file.file_path === 'package.json');
        const packageJson = packageJsonFile ? packageJsonFile.file_contents : '';
        this.setState({
            ...this.initialState,
            query,
            blueprint,
            templateDetails,
            lastCodeReview: undefined,
            sandboxInstanceId: undefined,
            enableFileEnhancement: true,
            generatedPhases: [],
            commandsHistory: [],
            lastPackageJson: packageJson,
            sessionId,
            hostname,
        });

        this.sandboxServiceClient = this.getSandboxServiceClient();
        this.projectSetupAssistant = this.getProjectSetupAssistant();

        this.logger = createObjectLogger(this, 'CodeGeneratorAgent');
        this.logger.setObjectId(sessionId);
        // Deploy to sandbox service and generate initial setup commands in parallel
        Promise.all([this.deployToSandbox(), this.projectSetupAssistant.generateSetupCommands()]).then(async ([, setupCommands]) => {
            this.logger.info("Deployment to sandbox service and initial commands predictions completed successfully");
            await this.executeCommands(setupCommands.commands);
        }).catch(error => {
            this.logger.error("Error during deployment:", error);
            this.broadcast(WebSocketMessageResponses.ERROR, {
                error: `Error during deployment: ${error instanceof Error ? error.message : String(error)}`
            });
        });

        this.logger.info("Agent initialized successfully");
    }

    getProjectSetupAssistant(): ProjectSetupAssistant {
        if (this.projectSetupAssistant === undefined) {
            this.projectSetupAssistant = new ProjectSetupAssistant({
                env: this.env,
                agentId: this.state.sessionId,
                query: this.state.query,
                blueprint: this.state.blueprint,
                template: this.state.templateDetails
            });
        }
        return this.projectSetupAssistant;
    }

    getSandboxServiceClient(): BaseSandboxService {
        if (this.sandboxServiceClient === undefined) {
            this.logger.info('Initializing sandbox service client');
            this.sandboxServiceClient = getSandboxService(this.state.sessionId, this.state.hostname);
        }
        return this.sandboxServiceClient;
    }

    isCodeGenerating(): boolean {
        return this.isGenerating;
    }

    /**
     * State machine controller for code generation with user interaction support
     * Executes phases sequentially with review cycles and proper state transitions
     */
    async generateAllFiles(reviewCycles: number = 10): Promise<void> {
        if (this.isGenerating) {
            this.logger.info("Code generation already in progress");
            return;
        }

        if (this.state.generatedPhases.find(phase => phase.name === "Finalization and Review") && this.state.pendingUserInputs.length === 0) {
            this.logger.info("Code generation already completed and no user inputs pending");
            return;
        }

        this.broadcast(WebSocketMessageResponses.GENERATION_STARTED, {
            message: 'Starting code generation',
            totalFiles: this.getTotalFiles()
        });

        this.isGenerating = true;
        let currentDevState = CurrentDevState.PHASE_IMPLEMENTING;
        const generatedPhases = this.state.generatedPhases;
        const completedPhases = generatedPhases.filter(phase => !phase.completed);
        let phaseConcept : PhaseConceptType | undefined;
        if (completedPhases.length > 0) {
            phaseConcept = completedPhases[completedPhases.length - 1];
        } else if (generatedPhases.length > 0) {
            currentDevState = CurrentDevState.PHASE_GENERATING;
        } else {
            phaseConcept = this.state.blueprint.initialPhase;
            this.setState({
                ...this.state,
                currentPhase: phaseConcept,
                generatedPhases: [{...phaseConcept, completed: false}]
            });
        }

        let staticAnalysisCache: StaticAnalysisResponse | undefined;

        // Store review cycles for later use
        this.setState({
            ...this.state,
            reviewCycles: reviewCycles
        });

        try {
            let executionResults: {currentDevState: CurrentDevState, staticAnalysis?: StaticAnalysisResponse, result?: PhaseConceptType};
            // State machine loop - continues until IDLE state
            while (currentDevState !== CurrentDevState.IDLE) {
                this.logger.info(`[generateAllFiles] Executing state: ${currentDevState}`);
                switch (currentDevState) {
                    case CurrentDevState.PHASE_GENERATING:
                        executionResults = await this.executePhaseGeneration();
                        currentDevState = executionResults.currentDevState;
                        phaseConcept = executionResults.result;
                        staticAnalysisCache = executionResults.staticAnalysis;
                        break;
                    case CurrentDevState.PHASE_IMPLEMENTING:
                        executionResults = await this.executePhaseImplementation(phaseConcept, staticAnalysisCache);
                        currentDevState = executionResults.currentDevState;
                        staticAnalysisCache = executionResults.staticAnalysis;
                        break;
                    case CurrentDevState.REVIEWING:
                        currentDevState = await this.executeReviewCycle();
                        break;
                    case CurrentDevState.FINALIZING:
                        currentDevState = await this.executeFinalizing();
                        break;
                    default:
                        break;
                }
            }

            this.logger.info("State machine completed successfully");
        } catch (error) {
            this.logger.error("Error in state machine:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.broadcast(WebSocketMessageResponses.ERROR, {
                error: `Error during generation: ${errorMessage}`
            });
        } finally {
            this.isGenerating = false;

            await this.updateDatabase({ status: 'completed' });

            this.broadcast(WebSocketMessageResponses.GENERATION_COMPLETE, {
                message: "Code generation and review process completed.",
                instanceId: this.state.sandboxInstanceId,
            });
        }
    }

    /**
     * Execute phase generation state - generate next phase with user suggestions
     */
    async executePhaseGeneration(): Promise<{currentDevState: CurrentDevState, result?:  PhaseConceptType, staticAnalysis?: StaticAnalysisResponse}> {
        this.logger.info("Executing PHASE_GENERATING state");
        try {
            const currentIssues = await this.fetchAllIssues();
            
            // Generate next phase with user suggestions if available
            const userSuggestions = this.state.pendingUserInputs.length > 0 ? this.state.pendingUserInputs : undefined;
            const nextPhase = await this.generateNextPhase(currentIssues, userSuggestions);
                
            if (!nextPhase) {
                this.logger.info("No more phases to implement, transitioning to FINALIZING");
                return {
                    currentDevState: CurrentDevState.FINALIZING,
                };
            }
            
            // Clear processed user inputs
            if (userSuggestions && userSuggestions.length > 0) {
                this.setState({
                    ...this.state,
                    pendingUserInputs: []
                });
                this.logger.info(`Processed ${userSuggestions.length} user suggestions in phase generation`);
            }
    
            // Store current phase and transition to implementation
            this.setState({
                ...this.state,
                currentPhase: nextPhase
            });
            
            return {
                currentDevState: CurrentDevState.PHASE_IMPLEMENTING,
                result: nextPhase,
                staticAnalysis: currentIssues.staticAnalysis
            };
        } catch (error) {
            this.logger.error("Error generating phase", error);
            return {
                currentDevState: CurrentDevState.IDLE,
            };
        }
    }

    /**
     * Execute phase implementation state - implement current phase
     */
    async executePhaseImplementation(phaseConcept?: PhaseConceptType, staticAnalysis?: StaticAnalysisResponse): Promise<{currentDevState: CurrentDevState, staticAnalysis?: StaticAnalysisResponse}> {
        try {
            this.logger.info("Executing PHASE_IMPLEMENTING state");
    
            if (phaseConcept === undefined) {
                phaseConcept = this.state.currentPhase;
                if (phaseConcept === undefined) {
                    this.logger.error("No phase concept provided to implement, will call phase generation");
                    const results = await this.executePhaseGeneration();
                    phaseConcept = results.result;
                    if (phaseConcept === undefined) {
                        this.logger.error("No phase concept provided to implement, will return");
                        return {currentDevState: CurrentDevState.FINALIZING};
                    }
                }
            }
    
            this.setState({
                ...this.state,
                currentPhase: undefined // reset current phase
            });
    
            let currentIssues : AllIssues;
            if (staticAnalysis) {
                // If have cached static analysis, fetch everything else fresh
                currentIssues = {
                    runtimeErrors: await this.fetchRuntimeErrors(true),
                    staticAnalysis: staticAnalysis,
                    clientErrors: this.state.clientReportedErrors
                };
            } else {
                currentIssues = await this.fetchAllIssues()
                this.resetIssues();
            }
            
            // Implement the phase
            await this.implementPhase(phaseConcept, currentIssues, null);
    
            this.logger.info(`Phase ${phaseConcept.name} completed, generating next phase`);

            if (phaseConcept.lastPhase) return {currentDevState: CurrentDevState.FINALIZING, staticAnalysis: staticAnalysis};
            return {currentDevState: CurrentDevState.PHASE_GENERATING, staticAnalysis: staticAnalysis};
        } catch (error) {
            this.logger.error("Error implementing phase", error);
            return {currentDevState: CurrentDevState.IDLE};
        }
    }

    /**
     * Execute review cycle state - run code review and regeneration cycles
     */
    async executeReviewCycle(): Promise<CurrentDevState> {
        this.logger.info("Executing REVIEWING state");

        const reviewCycles = 2;
        
        try {
            this.logger.info("Starting code review and improvement cycle...");

            for (let i = 0; i < reviewCycles; i++) {
                // Check if user input came during review - if so, go back to phase generation
                if (this.state.pendingUserInputs.length > 0) {
                    this.logger.info("User input received during review, transitioning back to PHASE_GENERATING");
                    return CurrentDevState.PHASE_GENERATING;
                }

                this.logger.info(`Starting code review cycle ${i + 1}...`);

                const reviewResult = await this.reviewCode();

                if (!reviewResult) {
                    this.logger.warn("Code review failed. Skipping fix cycle.");
                    break;
                }

                const issuesFound = reviewResult.issues_found;

                if (issuesFound) {
                    this.logger.info(`Issues found in review cycle ${i + 1}`);
                    const promises = [];

                    for (const fileToFix of reviewResult.files_to_fix) {
                        if (!fileToFix.require_code_changes) continue;
                        
                        const fileToRegenerate = this.state.generatedFilesMap[fileToFix.file_path];
                        if (!fileToRegenerate) {
                            this.logger.warn(`File to fix not found in generated files: ${fileToFix.file_path}`);
                            continue;
                        }
                        
                        promises.push(this.regenerateFile(
                            fileToRegenerate,
                            fileToFix.issues,
                            0
                        ));
                    }

                    const fileResults = await Promise.allSettled(promises);
                    let files: FileOutputType[] = fileResults.map(result => result.status === "fulfilled" ? result.value : null).filter((result) => result !== null);

                    await this.deployToSandbox(files);

                    // await this.applyDeterministicCodeFixes();

                    this.logger.info("Completed regeneration for review cycle");
                } else {
                    this.logger.info("Code review found no issues. Review cycles complete.");
                    break;
                }
            }

            // Check again for user input before finalizing
            if (this.state.pendingUserInputs.length > 0) {
                this.logger.info("User input received after review, transitioning back to PHASE_GENERATING");
                return CurrentDevState.PHASE_GENERATING;
            } else {
                this.logger.info("Review cycles complete, transitioning to IDLE");
                return CurrentDevState.IDLE;
            }

        } catch (error) {
            this.logger.error("Error during review cycle:", error);
            return CurrentDevState.IDLE;
        }
    }

    /**
     * Execute finalizing state - final review and cleanup (runs only once)
     */
    async executeFinalizing(): Promise<CurrentDevState> {
        this.logger.info("Executing FINALIZING state - final review and cleanup");

        // Only do finalizing stage if it wasn't done before
        if (this.state.generatedPhases.find(phase => phase.name === "Finalization and Review")) {
            this.logger.info("Finalizing stage already done");
            return CurrentDevState.REVIEWING;
        }

        const phaseConcept = {
            name: "Finalization and Review",
            description: FINAL_CODE_PHASE_DESCRIPTION,
            files: [],
            lastPhase: true
        }
        
        this.setState({
            ...this.state,
            generatedPhases: [
                ...this.state.generatedPhases,
                {
                    ...phaseConcept,
                    completed: false
                }
            ]
        });

        const currentIssues = await this.fetchAllIssues();
        this.resetIssues();
        
        // Run final review and cleanup phase
        await this.implementPhase(phaseConcept, currentIssues, null);

        const numFilesGenerated = Object.keys(this.state.generatedFilesMap).length;
        this.logger.info(`Finalization complete. Generated ${numFilesGenerated}/${this.getTotalFiles()} files.`);

        // Transition to IDLE - generation complete
        return CurrentDevState.REVIEWING;
    }

    /**
     * Generate next phase with raw user suggestions
     */
    async generateNextPhase(currentIssues: AllIssues, userSuggestions?: string[]): Promise<PhaseConceptGenerationSchemaType | undefined> {
        const context = GenerationContext.from(this.state, this.logger);
        const issues = IssueReport.from(currentIssues);
        // Notify phase generation start
        this.broadcast(WebSocketMessageResponses.PHASE_GENERATING, {
            message: userSuggestions && userSuggestions.length > 0
                ? `Generating next phase incorporating ${userSuggestions.length} user suggestions`
                : "Generating next phase"
        });
        
        const result = await this.operations.generateNextPhase.execute(
            {issues, userSuggestions},
            {
                env: this.env,
                agentId: this.state.sessionId,
                logger: this.logger,
                context,
            }
        )
        // Execute install commands if any
        if (result.installCommands && result.installCommands.length > 0) {
            this.executeCommands(result.installCommands);
        }
        
        if (result.files.length === 0) {
            this.logger.info("No files generated for next phase");
            return undefined;
        }
        
        this.setState({
            ...this.state,
            generatedPhases: [
                ...this.state.generatedPhases,
                {
                    ...result,
                    completed: false
                }
            ]
        });
        // Notify phase generation complete
        this.broadcast(WebSocketMessageResponses.PHASE_GENERATED, {
            message: `Generated next phase: ${result.name}`,
            phase: result
        });

        return result;
    }

    /**
     * Process user suggestions into technical instructions
     */
    async processUserSuggestions(currentIssues: AllIssues): Promise<TechnicalInstructionType | null> {
        if (this.state.pendingUserInputs.length === 0) {
            return null;
        }

        try {
            const suggestionInputs = {
                suggestions: this.state.pendingUserInputs,
                issues: IssueReport.from(currentIssues)
            };

            const context = GenerationContext.from(this.state, this.logger);
            const result = await this.operations.processSuggestions.execute(
                suggestionInputs,
                {
                    env: this.env,
                    agentId: this.state.sessionId,
                    logger: this.logger,
                    context,
                }
            );

            return result;
        } catch (error) {
            this.logger.error('Error processing user suggestions:', error);
            return null;
        }
    }

    /**
     * Implement a single phase of code generation
     * Streams file generation with real-time updates and incorporates technical instructions
     */
    async implementPhase(phase: PhaseConceptType, currentIssues: AllIssues, technicalInstructions?: TechnicalInstructionType | null): Promise<PhaseImplementationSchemaType> {
        const context = GenerationContext.from(this.state, this.logger);
        const issues = IssueReport.from(currentIssues);
        
        this.broadcast(WebSocketMessageResponses.PHASE_IMPLEMENTING, {
            message: technicalInstructions 
                ? `Implementing phase: ${phase.name} with ${technicalInstructions.instructions.length} user instructions`
                : `Implementing phase: ${phase.name}`,
            phase: phase,
            technicalInstructions: technicalInstructions
        });
            
        
        const result = await this.operations.implementPhase.execute(
            {
                phase, 
                issues, 
                technicalInstructions, 
                isFirstPhase: this.state.generatedPhases.filter(p => p.completed).length === 0,
                fileGeneratingCallback: (file_path: string, file_purpose: string) => {
                    this.broadcast(WebSocketMessageResponses.FILE_GENERATING, {
                        message: `Generating file: ${file_path}`,
                        file_path: file_path,
                        file_purpose: file_purpose
                    });
                },
                fileChunkGeneratedCallback: (file_path: string, chunk: string, format: 'full_content' | 'unified_diff') => {
                    this.broadcast(WebSocketMessageResponses.FILE_CHUNK_GENERATED, {
                        message: `Generating file: ${file_path}`,
                        file_path: file_path,
                        chunk,
                        format,
                    });
                },
                fileClosedCallback: (file: FileOutputType, message: string) => {
                    this.broadcast(WebSocketMessageResponses.FILE_GENERATED, {
                        message,
                        file,
                    });
                }
            },
            {
                env: this.env,
                agentId: this.state.sessionId,
                logger: this.logger,
                context,
            }
        );
        
        this.broadcast(WebSocketMessageResponses.PHASE_VALIDATING, {
            message: `Validating files for phase: ${phase.name}`,
            phase: phase,
        });
    
        // Await the already-created realtime code fixer promises
        const finalFiles = await Promise.allSettled(result.fixedFilePromises).then((results: PromiseSettledResult<FileOutputType>[]) => {
            return results.map((result) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return null;
                }
            }).filter((f): f is FileOutputType => f !== null);
        });
    
        // Update state with completed phase
        this.fileManager.saveGeneratedFiles(finalFiles);

        this.logger.info("Files generated for phase:", phase.name, finalFiles.map(f => f.file_path));

        // Execute commands if provided
        if (result.commands && result.commands.length > 0) {
            this.logger.info("Phase implementation suggested install commands:", result.commands);
            await this.executeCommands(result.commands);
        }
    
        // Deploy generated files
        if (finalFiles.length > 0) {
            await this.deployToSandbox(finalFiles);
            await this.applyDeterministicCodeFixes();
            // await this.applyFastSmartCodeFixes();
        }

        // Validation complete
        this.broadcast(WebSocketMessageResponses.PHASE_VALIDATED, {
            message: `Files validated for phase: ${phase.name}`,
            phase: phase
        });
    
        this.logger.info("Files generated for phase:", phase.name, finalFiles.map(f => f.file_path));
    
        this.logger.info(`Validation complete for phase: ${phase.name}`);
    
        // Notify phase completion
        this.broadcast(WebSocketMessageResponses.PHASE_IMPLEMENTED, {
            phase: {
                name: phase.name,
                files: finalFiles.map(f => ({
                    path: f.file_path,
                    purpose: f.file_purpose,
                    contents: f.file_contents
                })),
                description: phase.description
            },
            message: "Files generated successfully for phase"
        });
    
        const previousPhases = this.state.generatedPhases;
        // Replace the phase with the new one
        const updatedPhases = previousPhases.map(p => p.name === phase.name ? {...p, completed: true} : p);
        this.setState({
            ...this.state,
            generatedPhases: updatedPhases
        });

        this.logger.info("Completed phases:", JSON.stringify(updatedPhases, null, 2));
        
        return {
            files: finalFiles,
            deploymentNeeded: result.deploymentNeeded,
            commands: result.commands
        };
    }

    /**
     * Perform comprehensive code review
     * Analyzes for runtime errors, static issues, and best practices
     */
    async reviewCode() {
        const context = GenerationContext.from(this.state, this.logger);
        const issues = await this.fetchAllIssues();
        this.resetIssues();
        const issueReport = IssueReport.from(issues);

        // Report discovered issues
        this.broadcast(WebSocketMessageResponses.CODE_REVIEWING, {
            message: "Running code review...",
            staticAnalysis: issues.staticAnalysis,
            clientErrors: issues.clientErrors,
            runtimeErrors: issues.runtimeErrors
        });

        const reviewResult = await this.operations.codeReview.execute(
            {issues: issueReport},
            {
                env: this.env,
                agentId: this.state.sessionId,
                logger: this.logger,
                context,
            }
        );
        
        // Update state with review result
        this.setState({
            ...this.state,
            lastCodeReview: reviewResult
        });
        
        // Execute commands if any
        if (reviewResult.commands && reviewResult.commands.length > 0) {
            this.executeCommands(reviewResult.commands);
        }
        // Notify review completion
        this.broadcast(WebSocketMessageResponses.CODE_REVIEWED, {
            review: reviewResult,
            message: "Code review completed"
        });
        
        return reviewResult;
    }

    /**
     * Regenerate a file to fix identified issues
     * Retries up to 3 times before giving up
     */
    async regenerateFile(file: FileOutputType, issues: string[], retryIndex: number = 0) {
        const context = GenerationContext.from(this.state, this.logger);
        this.broadcast(WebSocketMessageResponses.FILE_REGENERATING, {
            message: `Regenerating file: ${file.file_path}`,
            file_path: file.file_path,
            original_issues: issues,
        });
        
        const result = await this.operations.regenerateFile.execute(
            {file, issues, retryIndex},
            {
                env: this.env,
                agentId: this.state.sessionId,
                logger: this.logger,
                context,
            }
        );

        this.fileManager.saveGeneratedFile(result);

        this.broadcast(WebSocketMessageResponses.FILE_REGENERATED, {
            message: `Regenerated file: ${file.file_path}`,
            file: result,
            original_issues: issues,
        });
        
        return result;
    }

    getTotalFiles(): number {
        return PhaseManagement.getTotalFiles(
            Object.keys(this.state.generatedFilesMap).length,
            this.state.currentPhase || this.state.blueprint.initialPhase
        );
    }

    getProgress(): Promise<CodeOutputType> {
        const progress = PhaseManagement.getProgress(
            this.state.generatedFilesMap,
            this.getTotalFiles()
        );
        return Promise.resolve(progress);
    }

    getFileGenerated(filePath: string) {
        return this.fileManager!.getGeneratedFile(filePath) || null;
    }

    getWebSockets(): WebSocket[] {
        return this.ctx.getWebSockets();
    }

    async fetchRuntimeErrors(clear: boolean = true) {
        if (!this.state.sandboxInstanceId || !this.fileManager) {
            this.logger.warn("No sandbox instance ID available to fetch errors from.");
            return [];
        }

        try {
            const resp = await this.getSandboxServiceClient().getInstanceErrors(this.state.sandboxInstanceId);
            if (!resp || !resp.success) {
                this.logger.error(`Failed to fetch runtime errors: ${resp?.error || 'Unknown error'}, Will initiate redeploy`);
                // Initiate redeploy
                this.deployToSandbox([], true);
                return [];
            }
            
            const errors = resp?.errors || [];

            if (errors.filter(error => error.message.includes('Unterminated string in JSON at position')).length > 0) {
                this.logger.error('Unterminated string in JSON at position, will initiate redeploy');
                // Initiate redeploy
                this.deployToSandbox([], true);
                return [];
            }
            
            if (errors.length > 0) {
                this.logger.info(`Found ${errors.length} runtime errors: ${errors.map(e => e.message).join(', ')}`);
                this.broadcast(WebSocketMessageResponses.RUNTIME_ERROR_FOUND, {
                    errors,
                    message: "Runtime errors found",
                    count: errors.length
                });
                
                if (clear) {
                    await this.getSandboxServiceClient().clearInstanceErrors(this.state.sandboxInstanceId);
                }
            }

            return errors;
        } catch (error) {
            this.logger.error("Exception fetching runtime errors:", error);
            return [];
        }
    }

    /**
     * Perform static code analysis on the generated files
     * This helps catch potential issues early in the development process
     */
    async runStaticAnalysisCode(): Promise<StaticAnalysisResponse> {
        const { sandboxInstanceId } = this.state;

        if (!sandboxInstanceId) {
            this.logger.warn("No sandbox instance ID available to lint code.");
            return { success: false, lint: { issues: [], }, typecheck: { issues: [], } };
        }

        this.logger.info(`Linting code in sandbox instance ${sandboxInstanceId}`);

        const files = Object.keys(this.state.generatedFilesMap);

        try {
            const analysisResponse = await this.getSandboxServiceClient()?.runStaticAnalysisCode(sandboxInstanceId, files);

            if (!analysisResponse || analysisResponse.error) {
                const errorMsg = `Code linting failed: ${analysisResponse?.error || 'Unknown error'}, full response: ${JSON.stringify(analysisResponse)}`;
                this.logger.error(errorMsg);
                this.broadcast(WebSocketMessageResponses.ERROR, { error: errorMsg, analysisResponse });
                throw new Error(errorMsg);
            }

            const { lint, typecheck } = analysisResponse;
            const { issues: lintIssues, summary: lintSummary } = lint;

            this.logger.info(`Linting found ${lintIssues.length} issues: ` +
                `${lintSummary?.errorCount || 0} errors, ` +
                `${lintSummary?.warningCount || 0} warnings, ` +
                `${lintSummary?.infoCount || 0} info`);

            const { issues: typeCheckIssues, summary: typeCheckSummary } = typecheck;

            this.logger.info(`Typecheck found ${typeCheckIssues.length} issues: ` +
                `${typeCheckSummary?.errorCount || 0} errors, ` +
                `${typeCheckSummary?.warningCount || 0} warnings, ` +
                `${typeCheckSummary?.infoCount || 0} info`);

            this.broadcast(WebSocketMessageResponses.STATIC_ANALYSIS_RESULTS, {
                lint: { issues: lintIssues, summary: lintSummary },
                typecheck: { issues: typeCheckIssues, summary: typeCheckSummary }
            });

            return analysisResponse;
        } catch (error) {
            this.logger.error("Error linting code:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.broadcast(WebSocketMessageResponses.ERROR, { error: `Failed to lint code: ${errorMessage}` });
            // throw new Error(`Failed to lint code: ${errorMessage}`);
            return { success: false, lint: { issues: [], }, typecheck: { issues: [], } };
        }
    }

    // private async applyFastSmartCodeFixes() : Promise<void> {
    //     try {
    //         const startTime = Date.now();
    //         this.logger.info("Applying fast smart code fixes");
    //         // Get static analysis and do deterministic fixes
    //         const staticAnalysis = await this.runStaticAnalysisCode();
    //         if (staticAnalysis.typecheck.issues.length + staticAnalysis.lint.issues.length == 0) {
    //             this.logger.info("No issues found, skipping fast smart code fixes");
    //             return;
    //         }
    //         const issues = staticAnalysis.typecheck.issues.concat(staticAnalysis.lint.issues);
    //         const allFiles = FileProcessing.getAllFiles(this.state.templateDetails, this.state.generatedFilesMap);
    //         const context = GenerationContext.from(this.state, this.logger);

    //         const fastCodeFixer = await this.operations.fastCodeFixer.execute({
    //             query: this.state.query,
    //             issues,
    //             allFiles,
    //         }, {
    //             env: this.env,
    //             agentId: this.state.sessionId,
    //             context,
    //             logger: this.logger
    //         });

    //         if (fastCodeFixer.length > 0) {
    //             this.fileManager.saveGeneratedFiles(fastCodeFixer);
    //             await this.deployToSandbox(fastCodeFixer);
    //             this.logger.info("Fast smart code fixes applied successfully");
    //         }
    //         this.logger.info(`Fast smart code fixes applied in ${Date.now() - startTime}ms`);            
    //     } catch (error) {
    //         this.logger.error("Error applying fast smart code fixes:", error);
    //         const errorMessage = error instanceof Error ? error.message : String(error);
    //         this.broadcast(WebSocketMessageResponses.ERROR, { error: `Failed to apply fast smart code fixes: ${errorMessage}` });
    //         return;
    //     }
    // }

    /**
     * Apply deterministic code fixes for common TypeScript errors
     */
    private async applyDeterministicCodeFixes() : Promise<StaticAnalysisResponse | undefined> {
        try {
            // Get static analysis and do deterministic fixes
            const staticAnalysis = await this.runStaticAnalysisCode();
            if (staticAnalysis.typecheck.issues.length == 0) {
                this.logger.info("No typecheck issues found, skipping deterministic fixes");
                return staticAnalysis;  // So that static analysis is not repeated again
            }
            const typeCheckIssues = staticAnalysis.typecheck.issues;
            this.broadcast(WebSocketMessageResponses.DETERMINISTIC_CODE_FIX_STARTED, {
                message: `Attempting to fix ${typeCheckIssues.length} TypeScript issues using deterministic code fixer`,
                issues: typeCheckIssues
            });

            this.logger.info(`Attempting to fix ${typeCheckIssues.length} TypeScript issues using deterministic code fixer`);
            const allFiles = FileProcessing.getAllFiles(this.state.templateDetails, this.state.generatedFilesMap);

            // Create file fetcher callback
            const fileFetcher: FileFetcher = async (filePath: string) => {
                // Fetch a single file from the instance
                try {
                    const result = await this.getSandboxServiceClient().getFiles(this.state.sandboxInstanceId!, [filePath]);
                    if (result.success && result.files.length > 0) {
                        this.logger.info(`Successfully fetched file: ${filePath}`);
                        return {
                            file_path: filePath,
                            file_contents: result.files[0].file_contents,
                            file_purpose: `Fetched file: ${filePath}`
                        };
                    } else {
                        this.logger.debug(`File not found: ${filePath}`);
                    }
                } catch (error) {
                    this.logger.debug(`Failed to fetch file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
                return null;
            };
            
            const fixResult = await fixProjectIssues(
                allFiles.map(file => ({
                    file_path: file.file_path,
                    file_contents: file.file_contents,
                    file_purpose: ''
                })),
                typeCheckIssues,
                fileFetcher
            );

            this.broadcast(WebSocketMessageResponses.DETERMINISTIC_CODE_FIX_COMPLETED, {
                message: `Fixed ${typeCheckIssues.length} TypeScript issues using deterministic code fixer`,
                issues: typeCheckIssues
            });

            if (fixResult) {
                if (fixResult.modifiedFiles.length > 0) {
                        this.logger.info("Applying deterministic fixes to files, Fixes: ", JSON.stringify(fixResult, null, 2));
                        const fixedFiles = fixResult.modifiedFiles.map(file => ({
                            file_path: file.file_path,
                            file_purpose: allFiles.find(f => f.file_path === file.file_path)?.file_purpose || '',
                            file_contents: file.file_contents
                    }));
                    this.fileManager.saveGeneratedFiles(fixedFiles);
                    
                    await this.deployToSandbox(fixedFiles);
                    this.logger.info("Deployed deterministic fixes to sandbox");
                }

                // If there are unfixable issues but of type TS2307, Extract the module that wasnt found and maybe try installing it
                if (fixResult.unfixableIssues.length > 0) {
                    const modulesNotFound = fixResult.unfixableIssues.filter(issue => issue.issueCode === 'TS2307');
                    // Reason would be of type `External package \"xyz\" should be handled by package manager`, extract via regex
                    const moduleNames = modulesNotFound.map(issue => issue.reason.match(/External package "(.+)"/)?.[1]);
                    
                    // Execute command
                    await this.executeCommands(moduleNames.map(moduleName => `bun install ${moduleName}`));
                    this.logger.info(`Deterministic code fixer installed missing modules: ${moduleNames.join(', ')}`);
                }
            }
            this.logger.info(`Applied deterministic code fixes: ${JSON.stringify(fixResult, null, 2)}`);
        } catch (error) {
            this.logger.error('Error applying deterministic code fixes:', error);
            this.broadcast(WebSocketMessageResponses.ERROR, {
                error: `Deterministic code fixer failed: ${error instanceof Error ? error.message : String(error)}`
            });
        }
        // return undefined;
    }


    async fetchAllIssues(): Promise<AllIssues> {
        const [runtimeErrors, staticAnalysis] = await Promise.all([
            this.fetchRuntimeErrors(false),
            this.runStaticAnalysisCode()
        ]);
        
        const clientErrors = this.state.clientReportedErrors;
        this.logger.info("Fetched all issues:", JSON.stringify({ runtimeErrors, staticAnalysis, clientErrors }));
        
        return { runtimeErrors, staticAnalysis, clientErrors };
    }

    async resetIssues() {
        this.logger.info("Resetting issues");
        await this.getSandboxServiceClient().clearInstanceErrors(this.state.sandboxInstanceId!);
        this.setState({
            ...this.state,
            clientReportedErrors: []
        });
    }

    async deployToSandbox(files: FileOutputType[] = [], redeploy: boolean = false): Promise<string | null> {
        // If there's already a deployment in progress, wait for it to complete
        if (this.currentDeploymentPromise) {
            this.logger.info('Deployment already in progress, waiting for completion before starting new deployment');
            try {
                await this.currentDeploymentPromise;
            } catch (error) {
                this.logger.warn('Previous deployment failed, proceeding with new deployment:', error);
            }
        }

        // Start the actual deployment and track it
        this.currentDeploymentPromise = this.executeDeployment(files, redeploy);
        
        try {
            // Add 60-second timeout to the deployment promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error('Deployment timed out after 60 seconds'));
                }, 60000);
            });
            
            const result = await Promise.race([
                this.currentDeploymentPromise,
                timeoutPromise
            ]);
            return result;
        } finally {
            // Clear the promise when deployment is complete
            this.currentDeploymentPromise = null;
        }
    }

    private async createNewDeployment(): Promise<{ sandboxInstanceId: string; previewURL: string; tunnelURL?: string } | null> {
        // Create new deployment
        const templateName = this.state.templateDetails?.name || 'scratch';
        // Generate a short unique suffix (6 chars from session ID)
        const uniqueSuffix = this.state.sessionId.slice(-6).toLowerCase();
        const projectName = `${this.state.blueprint?.projectName || templateName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${uniqueSuffix}`;
        
        // Generate webhook URL for this agent instance
        const webhookUrl = this.generateWebhookUrl();

        // TODO: REMOVE BEFORE PRODUCTION, SECURITY THREAT! Only for testing and demo
        let baseUrl: string = this.env.CLOUDFLARE_AI_GATEWAY_URL;
        try {
            baseUrl = await this.env.AI.gateway(this.env.CLOUDFLARE_AI_GATEWAY).getUrl()
        } catch (error) {
            this.logger.error(`Error getting AI gateway URL: ${error}`);
            // throw error;
        }
        const localEnvVars = {
            CF_AI_BASE_URL: `${baseUrl}/compat`,
            CF_AI_API_KEY: this.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
        }
        
        const createResponse = await this.getSandboxServiceClient().createInstance(templateName, `v1-${projectName}`, webhookUrl, true, localEnvVars);
        if (!createResponse || !createResponse.success || !createResponse.runId) {
            throw new Error(`Failed to create sandbox instance: ${createResponse?.error || 'Unknown error'}`);
        }

        this.logger.info(`Received createInstance response: ${JSON.stringify(createResponse, null, 2)}`)

        const sandboxInstanceId = createResponse.runId;
        const previewURL = createResponse.previewURL;
        const tunnelURL = createResponse.tunnelURL;
        if (sandboxInstanceId && previewURL) {
            return { sandboxInstanceId, previewURL, tunnelURL };
        }

        throw new Error(`Failed to create sandbox instance: ${createResponse?.error || 'Unknown error'}`);
    }

    private async executeDeployment(files: FileOutputType[] = [], redeploy: boolean = false): Promise<string | null> {
        const { templateDetails, generatedFilesMap } = this.state;
        let { sandboxInstanceId, previewURL, tunnelURL } = this.state;

        if (!templateDetails) {
            this.logger.error("Template details not available for deployment.");
            this.broadcast(WebSocketMessageResponses.ERROR, { error: "Template details not configured." });
            return null;
        }

        this.broadcast(WebSocketMessageResponses.DEPLOYMENT_STARTED, {
            message: "Deploying code to sandbox service",
            files: files.map(file => ({
                file_path: file.file_path,
            }))
        });

        this.logger.info("Deploying code to sandbox service");

        // Check if the instance is running
        if (sandboxInstanceId) {
            const status = await this.getSandboxServiceClient().getInstanceStatus(sandboxInstanceId);
            if (!status || !status.success) {
                this.logger.error(`DEPLOYMENT CHECK FAILED: Failed to get status for instance ${sandboxInstanceId}, redeploying...`);
                sandboxInstanceId = undefined;
            }
        }

        try {
            if (!sandboxInstanceId || redeploy) {
                const results = await this.createNewDeployment();
                if (!results || !results.sandboxInstanceId || !results.previewURL) {
                    this.broadcast(WebSocketMessageResponses.DEPLOYMENT_FAILED, {
                        message: "Failed to create new deployment",
                    });
                    throw new Error('Failed to create new deployment');
                }
                sandboxInstanceId = results.sandboxInstanceId;
                previewURL = results.previewURL;
                tunnelURL = results.tunnelURL;

                this.setState({
                    ...this.state,
                    sandboxInstanceId,
                    previewURL,
                    tunnelURL,
                });

                // Run all commands in background
                this.executeCommands(this.state.commandsHistory || []);

                // Launch a set interval to check the health of the deployment. If it fails, redeploy
                const checkHealthInterval = setInterval(async () => {
                    const status = await this.getSandboxServiceClient().getInstanceStatus(sandboxInstanceId!);
                    if (!status || !status.success) {
                        this.logger.error(`DEPLOYMENT CHECK FAILED: Failed to get status for instance ${sandboxInstanceId}, redeploying...`);
                        clearInterval(checkHealthInterval);
                        await this.executeDeployment([], true);
                    }
                }, 2000);

                // Launch a static analysis on the codebase in the background to build cache
                this.runStaticAnalysisCode();
            }

            // Deploy files
            const filesToWrite = files.length > 0 
                ? files.map(file => ({
                    file_path: file.file_path,
                    file_contents: file.file_contents
                }))
                : Object.values(generatedFilesMap).map(file => ({
                    file_path: file.file_path,
                    file_contents: file.file_contents
                }));

            if (filesToWrite.length > 0) {
                const writeResponse = await this.getSandboxServiceClient().writeFiles(sandboxInstanceId, filesToWrite);
                if (!writeResponse || !writeResponse.success) {
                    this.logger.warn(`File writing failed. Error: ${writeResponse?.error}`);
                }
            }

            this.broadcast(WebSocketMessageResponses.DEPLOYMENT_COMPLETED, {
                message: "Deployment completed",
                previewURL: previewURL,
                tunnelURL: tunnelURL,
                instanceId: sandboxInstanceId
            });

            return sandboxInstanceId;
        } catch (error) {
            this.logger.error("Error deploying to sandbox service:", error);
            this.setState({
                ...this.state,
                sandboxInstanceId: undefined,
                previewURL: undefined,
                tunnelURL: undefined,
            });
            return this.deployToSandbox();
        }
    }

    /**
     * Deploy the generated code to Cloudflare Workers
     */
    async deployToCloudflare(): Promise<{ deploymentUrl?: string; workersUrl?: string } | null> {
        try {
            this.logger.info('Starting Cloudflare deployment');
            this.broadcast(WebSocketMessageResponses.CLOUDFLARE_DEPLOYMENT_STARTED, {
                message: 'Starting deployment to Cloudflare Workers...',
                instanceId: this.state.sandboxInstanceId,
            });

            // Check if we have generated files
            if (!this.state.generatedFilesMap || Object.keys(this.state.generatedFilesMap).length === 0) {
                this.logger.error('No generated files available for deployment');
                this.broadcast(WebSocketMessageResponses.CLOUDFLARE_DEPLOYMENT_ERROR, {
                    message: 'Deployment failed: No generated code available',
                    error: 'No files have been generated yet'
                });
                return null;
            }

            // Check if we have a sandbox instance ID
            if (!this.state.sandboxInstanceId) {
                this.logger.info('[DeployToCloudflare] No sandbox instance ID available, will initiate deployment');
                // Need to redeploy
                await this.deployToSandbox();

                if (!this.state.sandboxInstanceId) {
                    this.logger.error('[DeployToCloudflare] Failed to deploy to sandbox service');
                    this.broadcast(WebSocketMessageResponses.CLOUDFLARE_DEPLOYMENT_ERROR, {
                        message: 'Deployment failed: Failed to deploy to sandbox service',
                        error: 'Sandbox service unavailable'
                    });
                    return null;
                }
            }

            this.logger.info('[DeployToCloudflare] Prerequisites met, initiating deployment', {
                sandboxInstanceId: this.state.sandboxInstanceId,
                fileCount: Object.keys(this.state.generatedFilesMap).length
            });

            // Call the actual deployment API endpoint
            const defaultCredentials = {
                apiToken: this.env.CLOUDFLARE_API_TOKEN,
                accountId: this.env.CLOUDFLARE_ACCOUNT_ID
            }; // TODO: Remove this before production

            const deploymentResult = await this.getSandboxServiceClient().deployToCloudflareWorkers(this.state.sandboxInstanceId, defaultCredentials);
            this.logger.info('[DeployToCloudflare] Deployment result:', deploymentResult);
            if (!deploymentResult) {
                this.logger.error('[DeployToCloudflare] Deployment API call failed');
                this.broadcast(WebSocketMessageResponses.CLOUDFLARE_DEPLOYMENT_ERROR, {
                    message: 'Deployment failed: API call returned null',
                    error: 'Deployment service unavailable'
                });
                return null;
            }

            if (!deploymentResult.success) {
                this.logger.error('Deployment failed', {
                    message: deploymentResult.message,
                    error: deploymentResult.error
                });
                this.broadcast(WebSocketMessageResponses.CLOUDFLARE_DEPLOYMENT_ERROR, {
                    message: `Deployment failed: ${deploymentResult.message}`,
                    error: deploymentResult.error || 'Unknown deployment error'
                });
                return null;
            }

            const deploymentUrl = deploymentResult.deployedUrl;

            this.logger.info('[DeployToCloudflare] Cloudflare deployment completed successfully', {
                deploymentUrl,
                deploymentId: deploymentResult.deploymentId,
                sandboxInstanceId: this.state.sandboxInstanceId,
                message: deploymentResult.message
            });

            // Update cloudflare URL in database
            await DatabaseOperations.updateDeploymentUrl(
                this.env,
                this.state.sessionId,
                this.logger,
                deploymentUrl || ''
            );

            // Broadcast success message
            this.broadcast(WebSocketMessageResponses.CLOUDFLARE_DEPLOYMENT_COMPLETED, {
                message: deploymentResult.message || 'Successfully deployed to Cloudflare Workers!',
                deploymentUrl
            });

            return { deploymentUrl };

        } catch (error) {
            return ErrorHandler.handleOperationError(
                this.logger,
                this,
                'Cloudflare deployment',
                error,
                WebSocketMessageResponses.CLOUDFLARE_DEPLOYMENT_ERROR
            );
        }
    }

    async analyzeScreenshot(): Promise<ScreenshotAnalysisType | null> {
        const screenshotData = this.state.latestScreenshot;
        if (!screenshotData) {
            this.logger.warn('No screenshot available for analysis');
            return null;
        }

        const context = GenerationContext.from(this.state, this.logger);    
        const result = await this.operations.analyzeScreenshot.execute(
            {screenshotData},
            {
                env: this.env,
                agentId: this.state.sessionId,
                context,
                logger: this.logger
            }
        );

        return result || null;
    }

    async waitForGeneration(): Promise<void> {
        if (this.state.generationPromise) {
            try {
                await this.state.generationPromise;
                this.logger.info("Code generation completed successfully");
            } catch (error) {
                this.logger.error("Error during code generation:", error);
            }
        } else {
            this.logger.error("No generation process found");
        }
    }

    async getNextAction(): Promise<AgentActionType> {
        return { action: 'No action', data: {} };
    }

    async executeAction(action: AgentActionType) {
        this.logger.info(`Executing action: ${action.action}`);
        return await executeAction(this, action);
    }

    async onMessage(connection: Connection, message: string): Promise<void> {
        handleWebSocketMessage(this, connection, message);
    }

    async onClose(connection: Connection): Promise<void> {
        handleWebSocketClose(connection);
    }

    private saveConversationMessages(messages: ConversationMessage[]) {
        this.setState({
            ...this.state,
            conversationMessages: [...this.state.conversationMessages, ...messages]
        });
    }

    public broadcast<T extends WebSocketMessageType>(type: T, data: WebSocketMessageData<T>): void;
    public broadcast(msg: string | ArrayBuffer | ArrayBufferView<ArrayBufferLike>, without?: string[]): void;
    
    public broadcast(
        typeOrMsg: WebSocketMessageType | string | ArrayBuffer | ArrayBufferView<ArrayBufferLike>, 
        dataOrWithout?: WebSocketMessageData<WebSocketMessageType> | unknown
    ): void {
        // Send the event to the conversational assistant if its a relevant event
        if (this.operations.processUserMessage.isProjectUpdateType(typeOrMsg)) {
            const messages = this.operations.processUserMessage.processProjectUpdates(typeOrMsg, dataOrWithout as WebSocketMessageData<WebSocketMessageType>, this.logger);
            this.saveConversationMessages(messages);
        }
        broadcastToConnections(this, typeOrMsg as WebSocketMessageType, dataOrWithout as WebSocketMessageData<WebSocketMessageType>);
    }

    /**
     * Handle HTTP requests to this agent instance
     * Includes webhook processing for internal requests
     */
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Handle internal webhook requests
        if (pathname.startsWith('/webhook/')) {
            return this.handleWebhook(request);
        }

        // Delegate to parent class for other requests
        return super.fetch(request);
    }

    /**
     * Generate webhook URL for this agent instance
     */
    private generateWebhookUrl(): string {
        // Use the agent's session ID as the agent identifier
        const agentId = this.state.sessionId || 'unknown';
        
        // Generate webhook URL with agent ID for routing
        return `${getProtocolForHost(this.state.hostname)}://${this.state.hostname}/api/webhook/sandbox/${agentId}/runtime_error`;
    }

    /**
     * Handle webhook events from sandbox service
     */
    async handleWebhook(request: Request): Promise<Response> {
        try {
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/');
            const eventType = pathParts[pathParts.length - 1];

            this.logger.info('Received webhook from sandbox service', { 
                eventType, 
                agentId: this.state.sessionId 
            });

            const payload = await request.json() as WebhookPayload;
            const { event, context, source } = payload;

            if (source !== 'webhook') {
                return new Response('Invalid source', { status: 400 });
            }

            // Process the webhook event
            await this.processWebhookEvent(event, context);

            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });

        } catch (error) {
            this.logger.error('Error handling webhook', error);
            return new Response('Internal server error', { status: 500 });
        }
    }

    /**
     * Process webhook events and trigger appropriate actions
     */
    private async processWebhookEvent(event: WebhookPayload['event'], context: WebhookPayload['context']): Promise<void> {
        try {
            switch (event.eventType) {
                case 'runtime_error':
                    await this.handleRuntimeErrorWebhook(event, context);
                    break;
                default:
                    this.logger.warn('Unhandled webhook event type', { eventType: event.eventType });
            }
        } catch (error) {
            this.logger.error('Error processing webhook event', error);
        }
    }

    /**
     * Handle runtime error webhook events
     */
    private async handleRuntimeErrorWebhook(event: WebhookPayload['event'], _context: WebhookPayload['context']): Promise<void> {
        if (!event.payload.error) {
            this.logger.error('Invalid runtime error event: No error provided');
            return;
        }
        this.logger.info('Processing runtime error webhook', {
            errorMessage: event.payload.error.message,
            runId: event.payload.runId,
            instanceId: event.instanceId
        });

        // Broadcast runtime error to connected clients
        this.broadcast(WebSocketMessageResponses.RUNTIME_ERROR_FOUND, {
            error: event.payload.error,
            runId: event.payload.runId,
            instanceInfo: event.payload.instanceInfo,
            instanceId: event.instanceId,
            timestamp: event.timestamp,
            source: 'webhook'
        });
    }

    // /**
    //  * Get project dependencies from state and package.json
    //  */
    // private getDependencies(): Record<string, string> {
    //     const state = this.state;
    //     const deps = state.templateDetails?.deps || {};
    //     // Add additional dependencies from the last package.json
    //     if (state.lastPackageJson) {
    //         const parsedPackageJson = JSON.parse(state.lastPackageJson);
    //         Object.assign(deps, parsedPackageJson.dependencies as Record<string, string>);
    //         this.logger.info(`Adding dependencies from last package.json: ${Object.keys(parsedPackageJson.dependencies).join(', ')}`);
    //     }
    //     return deps;
    // }

    /**
     * Execute commands with retry logic
     * Chunks commands and retries failed ones with AI assistance
     */
    private async executeCommands(commands: string[]): Promise<void> {
        const state = this.state;
        if (!state.sandboxInstanceId) {
            this.logger.warn('No sandbox instance available for executing commands');
            return;
        }

        // Sanitize and prepare commands
        commands = commands.join('\n').split('\n').filter(cmd => cmd.trim() !== '').filter(cmd => looksLikeCommand(cmd));
        if (commands.length === 0) {
            this.logger.warn("No commands to execute");
            return;
        }

        commands = commands.map(cmd => cmd.trim().replace(/^\s*-\s*/, '').replace(/^npm/, 'bun'));
        this.logger.info(`AI suggested ${commands.length} commands to run: ${commands.join(", ")}`);

        // Execute in chunks of 5 for better reliability
        const chunkSize = 5;
        const commandChunks = [];
        for (let i = 0; i < commands.length; i += chunkSize) {
            commandChunks.push(commands.slice(i, i + chunkSize));
        }

        const successfulCommands: string[] = [];

        for (const chunk of commandChunks) {
            // Retry failed commands up to 3 times
            let currentChunk = chunk;
            for (let i = 0; i < 3 && currentChunk.length > 0; i++) {
                try {
                    this.broadcast(WebSocketMessageResponses.COMMAND_EXECUTING, {
                        message: "Executing commands",
                        commands: currentChunk
                    });
                    const resp = await this.getSandboxServiceClient().executeCommands(
                        state.sandboxInstanceId,
                        currentChunk
                    );
                    if (!resp || !resp.results) {
                        this.logger.error('Failed to execute commands');
                        return;
                    }

                    // Filter out successful commands
                    const successful = resp.results.filter(r => r.success);
                    const failures = resp.results.filter(r => !r.success);

                    if (successful.length > 0) {
                        this.logger.info(`Commands executed successfully: ${currentChunk.join(", ")}`);
                        successfulCommands.push(...successful.map(r => r.command));

                        if (successful.length === currentChunk.length) {
                            this.logger.info(`All commands executed successfully in this chunk: ${currentChunk.join(", ")}`);
                            break;
                        }
                    }
                    
                    if (failures.length > 0) {
                        this.logger.warn(`Some commands failed to execute: ${failures.map(r => r.command).join(", ")}, will retry`);
                    } else {
                        this.logger.error(`This should never happen, while executing commands ${currentChunk.join(", ")}, response: ${JSON.stringify(resp)}`);
                    }
                    // Use AI to regenerate failed commands
                    const newCommands = await this.getProjectSetupAssistant().generateSetupCommands(
                        `The following failures were reported: ${failures.length > 0 ? JSON.stringify(failures, null, 2) :  currentChunk.join(", ")}. The following commands were successful: ${successful.map(r => r.command).join(", ")}`
                    );
                    if (newCommands?.commands) {
                        this.logger.info(`Generated new commands: ${newCommands.commands.join(", ")}`);
                        this.broadcast(WebSocketMessageResponses.COMMAND_EXECUTING, {
                            message: "Executing regenerated commands",
                            commands: newCommands.commands
                        });
                        currentChunk = newCommands.commands.filter(looksLikeCommand);
                    } else {
                        break;
                    }

                    this.broadcast(WebSocketMessageResponses.ERROR, {
                        error: `Failed to execute commands: ${failures.map(r => r.command).join(", ")}`,
                        failures
                    });
                } catch (error) {
                    this.logger.error('Error executing commands:', error);
                }
            }
        }

        // Record command execution history
        const failedCommands = commands.filter(cmd => !successfulCommands.includes(cmd));
        
        if (failedCommands.length > 0) {
            this.logger.warn(`Failed to execute commands: ${failedCommands.join(", ")}`);
            this.broadcast(WebSocketMessageResponses.ERROR, {
                error: `Failed to execute commands: ${failedCommands.join(", ")}`
            });
        } else {
            this.logger.info(`All commands executed successfully: ${successfulCommands.join(", ")}`);
        }

        // Add commands to history
        this.setState({
            ...this.state,
            commandsHistory: [
                ...(this.state.commandsHistory || []),
                // ...commands.map(cmd => (
                //     // If command is in successfulCommands, add '#SUCCESS' to it
                //     successfulCommands.includes(cmd) ? `${cmd} #SUCCESS` : `${cmd} #FAILURE`
                // ))
                ...successfulCommands
            ]
        });
    }

    /**
     * Export generated code to a GitHub repository
     * Creates repository and pushes all generated files
     */
    async exportToGithub(options: GitHubExportOptions): Promise<GitHubExportResult> {
        try {
            this.logger.info('Starting GitHub export', {
                repositoryName: options.repositoryName,
                isPrivate: options.isPrivate,
                fileCount: Object.keys(this.state.generatedFilesMap).length
            });

            // Check if we have generated files
            if (!this.state.generatedFilesMap || Object.keys(this.state.generatedFilesMap).length === 0) {
                return ErrorHandler.handleGitHubExportError(
                    this.logger,
                    this,
                    'Export failed: No generated code available',
                    'No generated files available for export'
                );
            }

            // Check if we have a sandbox instance
            if (!ErrorHandler.validateRunnerInstance(
                this.state.sandboxInstanceId,
                this.logger,
                this,
                'GitHub export'
            )) {
                return ErrorHandler.handleGitHubExportError(
                    this.logger,
                    this,
                    'Export failed: Runner service not available',
                    'No sandbox instance available for GitHub export'
                );
            }

            // Broadcast export started
            this.broadcast(WebSocketMessageResponses.GITHUB_EXPORT_STARTED, {
                message: `Starting GitHub export to repository "${options.repositoryName}"`,
                repositoryName: options.repositoryName,
                isPrivate: options.isPrivate
            });

            // Step 1: Create GitHub repository
            this.broadcast(WebSocketMessageResponses.GITHUB_EXPORT_PROGRESS, {
                message: 'Creating GitHub repository...',
                step: 'creating_repository',
                progress: 10
            });

            // Get GitHub integration data for the user
            const githubIntegration = await this.getGitHubIntegration(options.userId);
            if (!githubIntegration) {
                return ErrorHandler.handleGitHubExportError(
                    this.logger,
                    this,
                    'GitHub integration not found',
                    'User must connect GitHub account first'
                );
            }

            const exportRequest: GitHubExportRequest = {
                token: githubIntegration.accessToken,
                repositoryName: options.repositoryName,
                description: options.description || `Generated web application: ${this.state.blueprint?.title || options.repositoryName}`,
                isPrivate: options.isPrivate,
                email: githubIntegration.email,
                username: githubIntegration.username,
                commitMessage: `Initial commit: Generated web application\n\n🤖 Generated with Orange Build\n${this.state.blueprint?.title ? `Blueprint: ${this.state.blueprint.title}` : ''}`
            };

            this.logger.info('Exporting to GitHub repository', { exportRequest });

            // Update progress for creating repository
            this.broadcast(WebSocketMessageResponses.GITHUB_EXPORT_PROGRESS, {
                message: 'Creating GitHub repository and uploading files...',
                step: 'uploading_files',
                progress: 30
            });

            // Use consolidated export method that handles the complete flow
            const exportResult = await this.getSandboxServiceClient().exportToGitHub(this.state.sandboxInstanceId!, exportRequest);

            if (!exportResult?.success) {
                return ErrorHandler.handleGitHubExportError(
                    this.logger,
                    this,
                    'Failed to export to GitHub repository',
                    exportResult?.error || 'Failed to export to GitHub repository'
                );
            }

            const repositoryUrl = exportResult.repositoryUrl;
            this.logger.info('GitHub export completed successfully', { repositoryUrl, commitSha: exportResult.commitSha });

            // Step 3: Finalize
            this.broadcast(WebSocketMessageResponses.GITHUB_EXPORT_PROGRESS, {
                message: 'Finalizing GitHub export...',
                step: 'finalizing',
                progress: 90
            });

            // Update database with GitHub repository URL
            await DatabaseOperations.updateGitHubRepository(
                this.env,
                this.state.sessionId || '',
                this.logger,
                repositoryUrl || ''
            );

            // Broadcast success
            this.broadcast(WebSocketMessageResponses.GITHUB_EXPORT_COMPLETED, {
                message: `Successfully exported to GitHub repository: ${repositoryUrl}`,
                repositoryUrl
            });

            this.logger.info('GitHub export completed successfully', { repositoryUrl });
            return { success: true, repositoryUrl };

        } catch (error) {
            return ErrorHandler.handleGitHubExportError(
                this.logger,
                this,
                'GitHub export failed due to an unexpected error',
                error instanceof Error ? error.message : String(error)
            );
        }
    }

    /**
     * Get GitHub integration data for a user
     */
    private async getGitHubIntegration(userId?: string): Promise<{ accessToken: string; username: string; email: string } | null> {
        if (!this.env.DB || !userId) {
            this.logger.warn('No database or userId provided for GitHub integration lookup');
            return null;
        }

        try {
            const dbService = new DatabaseService({ DB: this.env.DB });
            
            // Get both GitHub integration data and user email in a single query with join
            const result = await dbService.db
                .select({
                    accessTokenHash: schema.githubIntegrations.accessTokenHash,
                    githubUsername: schema.githubIntegrations.githubUsername,
                    userEmail: schema.users.email
                })
                .from(schema.githubIntegrations)
                .innerJoin(schema.users, eq(schema.githubIntegrations.userId, schema.users.id))
                .where(eq(schema.githubIntegrations.userId, userId))
                .limit(1);

            if (!result[0]) {
                this.logger.warn('No GitHub integration found for user', { userId });
                return null;
            }

            const integration = result[0];
            this.logger.info('Retrieved GitHub integration with real email', { 
                userId, 
                username: integration.githubUsername,
                email: integration.userEmail 
            });

            // For now, we'll use the stored token directly
            // In production, you'd want to decrypt the token hash
            return {
                accessToken: integration.accessTokenHash, // This should be decrypted in production
                username: integration.githubUsername,
                email: integration.userEmail // Real user email from users table
            };
        } catch (error) {
            this.logger.error('Error fetching GitHub integration', error);
            return null;
        }
    }


    /**
     * Update database with generation status
     */
    /**
     * Handle user input during conversational code generation
     * Processes user messages and updates pendingUserInputs state
     */
    async handleUserInput(userMessage: string): Promise<void> {
        try {
            this.logger.info('Processing user input message', { 
                messageLength: userMessage.length,
                pendingInputsCount: this.state.pendingUserInputs.length 
            });

            const context = GenerationContext.from(this.state, this.logger);

            // Process the user message using conversational assistant
            const conversationalResponse = await this.operations.processUserMessage.execute(
                { 
                    userMessage, 
                    pastMessages: this.state.conversationMessages,
                    conversationResponseCallback: (message: string, conversationId: string, isStreaming: boolean) => {
                        this.broadcast(WebSocketMessageResponses.CONVERSATION_RESPONSE, {
                            message,
                            conversationId,
                            isStreaming,
                        });
                    }
                }, 
                { env: this.env, agentId: this.state.sessionId, context, logger: this.logger}
            );

            const { conversationResponse, newMessages } = conversationalResponse;
            this.saveConversationMessages(newMessages);

            // Add enhanced request to pending user inputs
            const updatedPendingInputs = [
                ...this.state.pendingUserInputs,
                conversationResponse.enhancedUserRequest
            ];

            // Update state with new pending input
            this.setState({
                ...this.state,
                pendingUserInputs: updatedPendingInputs
            });

             if (!this.isGenerating) {
                // If idle, start generation process
                this.logger.info('User input during IDLE state, starting generation');
                this.generateAllFiles().catch(error => {
                    this.logger.error('Error starting generation from user input:', error);
                });
            }
            // For PHASE_GENERATING and PHASE_IMPLEMENTING states, just queue the input - it will be processed naturally

            // Send response back to user via WebSocket
            // this.broadcast(WebSocketMessageResponses.CONVERSATION_RESPONSE, {
            //     message: conversationResponse.userResponse,
            //     enhancedRequest: conversationResponse.enhancedUserRequest,
            //     pendingInputsCount: updatedPendingInputs.length
            // });

            this.logger.info('User input processed successfully', {
                responseLength: conversationResponse.userResponse.length,
                enhancedRequestLength: conversationResponse.enhancedUserRequest.length,
                totalPendingInputs: updatedPendingInputs.length,
            });

        } catch (error) {
            this.logger.error('Error handling user input:', error);
            this.broadcast(WebSocketMessageResponses.ERROR, {
                error: `Error processing user input: ${error instanceof Error ? error.message : String(error)}`
            });
        }
    }

    private async updateDatabase(data: {
        status?: 'completed' | 'failed' | 'in_progress' | 'deployed';
        deploymentUrl?: string;
        [key: string]: unknown;
    }): Promise<void> {
        if (!this.env.DB || !this.state.sessionId) {
            return;
        }

        try {
            
            if (data.status === 'completed') {
                const state = this.state;
                const generatedFiles = Object.entries(state.generatedFilesMap).map(([path, file]) => ({
                    file_path: path,
                    file_contents: file.file_contents,
                    explanation: file.file_purpose || ''
                }));

                await DatabaseOperations.updateApp(this.env, this.state.sessionId, this.logger, {
                    status: 'completed',
                    generatedFiles: generatedFiles,
                    // deploymentUrl: state.previewURL
                });
            } else if (data.deploymentUrl) {
                await DatabaseOperations.updateDeploymentUrl(
                    this.env,
                    this.state.sessionId,
                    this.logger,
                    data.deploymentUrl
                );
            }
        } catch (error) {
            this.logger.error('Failed to update database:', error);
        }
    }
}