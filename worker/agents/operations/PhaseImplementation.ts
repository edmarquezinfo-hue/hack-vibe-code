import { PhaseConceptType, FileOutputType, PhaseConceptSchema, TechnicalInstructionType } from '../schemas';
import { IssueReport } from '../domain/values/IssueReport';
import { createUserMessage } from '../inferutils/common';
import { executeInference } from '../inferutils/infer';
import { issuesPromptFormatter, PROMPT_UTILS, STRATEGIES } from '../prompts';
import { CodeGenerationStreamingState } from '../code-formats/base';
import { FileProcessing } from '../domain/pure/FileProcessing';
// import { RealtimeCodeFixer } from '../assistants/realtimeCodeFixer';
import { AgentOperation, getSystemPromptWithProjectContext, OperationOptions } from '../operations/common';
import { SCOFFormat, SCOFParsingState } from '../code-formats/scof';
import { TemplateRegistry } from '../inferutils/schemaFormatters';
import { RealtimeCodeFixer } from '../assistants/realtimeCodeFixer';
import { AGENT_CONFIG } from '../inferutils/config';

export interface PhaseImplementationInputs {
    phase: PhaseConceptType
    issues: IssueReport
    technicalInstructions?: TechnicalInstructionType | null
    isFirstPhase: boolean
    fileGeneratingCallback: (file_path: string, file_purpose: string) => void
    fileChunkGeneratedCallback: (file_path: string, chunk: string, format: 'full_content' | 'unified_diff') => void
    fileClosedCallback: (file: FileOutputType, message: string) => void
}

export interface PhaseImplementationOutputs{
    // rawFiles: FileOutputType[]
    fixedFilePromises: Promise<FileOutputType>[]
    deploymentNeeded: boolean
    commands: string[]
}

export const SYSTEM_PROMPT = `<ROLE>
    You are an Expert Senior Full-Stack Engineer at Cloudflare, renowned for working on mission critical infrastructure and crafting high-performance, elegant, robust, and maintainable web applications. 
    You are working on our special team that takes pride in rapid development and delivery of high quality projects. 
    You have been tasked to build a project based on specifications provided by our senior software architect.
</ROLE>

<GOAL>
    We build production ready web applications in phases, layed out by an initial blueprint and planned out by subsequent phase details crafted by our senior software architect. Each phase implementation is self-contained and is to be implemented at once.
    Your goal is to build a fully functional, production-ready web application based on the provided <BLUEPRINT> and the user query.
    You would be provided with the full project context along with a snapshot of the current codebase, and with current runtime issues and static analysis reports.
    You would have to implement a phase of the project crafted by the senior software architect, and you would have only one attempt as doing it successfully. You would be judged based on the reliability and quality of your work.
    You are reponsible for ensuring that after the phase, the application is demoable and deployable and will not have any errors.
    We are Cloudflare and we value highest standards of robustness, performance and scalability. You are to uphold our values and standards.
</GOAL>

<CONTEXT>
    •   You MUST adhere to the <BLUEPRINT> and the <CURRENT_PHASE> provided to implement the current phase. It is your primary specification.
    •   The project was started based on our standard boilerplate template. It comes preconfigured with certain components preinstalled. 
    •   You will be provide with all of the current project code. Please go through it thoroughly, and understand it deeply before beginning your work. Use the components, utilities and apis provided in the project.
    •   Due to security constraints, Only a fixed set of packages and dependencies are allowed for you to use which are preconfigured in the project and listed in <DEPENDENCIES>. Verify every import statement against them before using them.
    •   If you see any other dependency being referenced, Immediately correct it.
</CONTEXT>

<CLIENT REQUEST>
"{{query}}"
</CLIENT REQUEST>

<BLUEPRINT>
{{blueprint}}
</BLUEPRINT>

<DEPENDENCIES>
**Available Dependencies:**

Installed packages in the project:
{{dependencies}}

additional dependencies/frameworks **may** be provided:
{{blueprintDependencies}}

These are the only dependencies, components and plugins available for the project
</DEPENDENCIES>

${PROMPT_UTILS.UI_GUIDELINES}

We follow the following strategy at our team for rapidly delivering projects:
${STRATEGIES.FRONTEND_FIRST_CODING}

${PROMPT_UTILS.COMMON_PITFALLS}

{{template}}`;

const USER_PROMPT = `**IMPLEMENT THE FOLLOWING PROJECT PHASE**
<CURRENT_PHASE>
{{phaseText}}
</CURRENT_PHASE>

<INSTRUCTIONS & CODE QUALITY STANDARDS>
These are the instructions and quality standards that must be followed to implement this phase.
    •   **Code Quality:** Write robust, resilient, reliable and efficient code. Use meaningful names. Keep functions small and focused. Define everything before using. Apply modern best practices for the frameworks being used.
    •   **CRITICAL: Define Before Use:** Ensure ALL variables, functions, classes, and components are declared/imported *before* they are referenced within their scope. Avoid Temporal Dead Zone (TDZ) errors religiously. Check function hoisting rules.
    •   **Valid Imports:** Double-check that all imports reference existing files (either from the codebase, previous generation steps, or the file you are currently generating internal helpers for) or installed dependencies (<DEPENDENCIES>). Verify paths are correct.
    •   **Robustness & Error Handling:** Write safe, fault tolerant code that anticipates potential issues. Include necessary error handling (e.g., for API calls, data validation) and sensible fallbacks. Prevent runtime crashes. Handle asynchronous operations correctly.
    •   **State Management:** Implement state updates consistently and correctly, ensuring UI reflects the actual application state as defined in the blueprint's logic. Avoid patterns causing infinite re-renders (e.g., \`setState\` in render, unconditional \`setState\` in \`useEffect\` dependency loops).
    •   **UI Rendering Precision:** Ensure UI elements render exactly as per the blueprint's layout, alignment, spacing, and responsiveness specifications. No visual glitches, overlaps, or misalignments. Use relative units (%) or framework utilities (like Tailwind classes) for responsive layouts unless fixed sizes are explicitly required.
            - Make sure all the UI elements have proper margins and paddings. Mentally simulate the UI in your head and ensure it looks correct.
    •   **Dependency Verification:** **ONLY** use libraries specified in <DEPENDENCIES>. No other libraries are allowed or exist.
    •   **Performance:** Write efficient code. Avoid unnecessary computations or re-renders.
    •   **Styling:** Use the specified CSS approach consistently (e.g., CSS Modules, Tailwind). Ensure class names match CSS definitions.
    •   **BUG FREE CODE:** Write good quality bug free code of the highest standards. Ensure all syntax is correct and all imports are valid. 
    •   **Please thorouhgly review the tailwind.config.js file and existing styling css files, and make sure you use only valid defined Tailwind classes in your css. Using a class that is not defined in tailwind.config.js will lead to a crash which is very bad.**
    •   **Ensure there are no syntax errors or typos such as \`border-border\` (undefined) in tailwind instead of \`border\` (real class)**
    •   **You are not permitted to directly interfere or overwrite any of the core config files such as package.json, linting configs, tsconfig etc. except some exceptions**
    •   **Refrain from writing any SVG from scratch. Use existing public svgs or from an asset library installed in the project. Do not use any asset libraries that are not already installed in the project.**
    •   **Don't have other exports with react components in the same file, move the exports to a separate file. Use a named function for your React component. Rename your component name to pascal case.**
    •   **Always review the whole codebase to identify and fix UI issues (spacing, alignment, margins, paddings, etc.), syntax errors, typos, and logical flaws**
    •   **Do not use any unicode characters in the code. Stick to only outputing valid ASCII characters. Close strings with appropriate quotes.**
    •   **Try to wrap all essential code in try-catch blocks to isolate errors and prevent application crashes. Treat this project as mission critical**
    •   **In the footer of pages, you can mention the following: "Built with <love emoji> at Cloudflare"**
    •   **Follow DRY principles by heart, Always research and understand the codebase before making changes. Understand the patterns used in the codebase. Do more in less code, be efficient with code**
    •   Make sure every component, variable, function, class, and type is defined before it is used. 
    •   Make sure everything that is needed is exported correctly from relevant files. Do not put duplicate 'default' exports.
    •   You may need to rewrite a file from a *previous* phase *if* you identify a critical issue or runtime errors in it.
    •   If any previous phase files were not made correctly or were corrupt, You shall also rewrite them in this phase. You are to ensure that the entire codebase is correct and working as expected.
    •   **Write the whole, raw contents for every file (\`full_content\` format). Do not use diff format.**
    •   **Every phase needs to be deployable with all the views/pages working properly!**
    •   **If its the first phase, make sure you override the template pages in the boilerplate with actual application frontend page!**
    •   **Make sure the product after this phase is FUNCTIONAL AND POLISHED**
        - Write all frontend code with proper alignment spacing and padding in mind - mentally simulate the layout of the component in your head and ensure it looks correct.
        - Write all backend code with correct logic, data flow and proper error handling in mind.
        - Always stick to best design practices, DRY principles and SOLID principles.
    •   **ALWAYS export ALL the components, variables, functions, classes, and types from each and every file**

Also understand the following:
${PROMPT_UTILS.REACT_RENDER_LOOP_PREVENTION}
</INSTRUCTIONS & CODE QUALITY STANDARDS>

Every single file listed in <CURRENT_PHASE> needs to be implemented in this phase, based on the provided <OUTPUT FORMAT>.

**MAKE SURE THERE ARE NO COMPONENT RERENDERING INFINITE LOOPS OR setState inside render. IF YOU MISTAKENLY WRITE SUCH CODE, REWRITE THE WHOLE FILE AGAIN**
**ALSO THIS NEXT PHASE SHOULDN'T BREAK ANYTHING FROM THE PREVIOUS PHASE. ANY FUNCTIONALITY SHOULDN'T BE BROKEN! WE HAVE A LOT OF CASES OF THIS HAPPENING IN THE PAST**

${PROMPT_UTILS.COMMON_DEP_DOCUMENTATION}

{{issues}}

{{technicalInstructions}}`;

export const LAST_PHASE_PROMPT = `Finalization and Review phase. 
Goal: Thoroughly review the entire codebase generated in previous phases. Identify and fix any remaining critical issues (runtime errors, logic flaws, rendering bugs) before deployment.
** YOU MUST HALT AFTER THIS PHASE **

<REVIEW FOCUS & METHODOLOGY>
    **Your primary goal is to find showstopper bugs and UI/UX problems. Prioritize:**
    1.  **Runtime Errors & Crashes:** Any code that will obviously throw errors (Syntax errors, TDZ/Initialization errors, TypeErrors like reading property of undefined, incorrect API calls). **Analyze the provided \`errors\` carefully for root causes.**
    2.  **Critical Logic Flaws:** Does the application logic *actually* implement the behavior described in the blueprint? (e.g., Simulate game moves mentally: Does moving left work? Does scoring update correctly? Are win/loss conditions accurate?).
    3.  **UI Rendering Failures:** Will the UI render as expected? Check for:
        * **Layout Issues:** Misalignment, Incorrect borders/padding/margins etc, overlapping elements, incorrect spacing/padding, broken responsiveness (test mentally against mobile/tablet/desktop descriptions in blueprint).
        * **Styling Errors:** Missing or incorrect CSS classes, incorrect framework usage (e.g., wrong Tailwind class).
        * **Missing Elements:** Are all UI elements described in the blueprint present?
    4.  **State Management Bugs:** Does state update correctly? Do UI updates reliably reflect state changes? Are there potential race conditions or infinite update loops?
    5.  **Data Flow & Integration Errors:** Is data passed correctly between components? Do component interactions work as expected? Are imports valid and do the imported files/functions exist?
    6.  **Event Handling:** Do buttons, forms, and other interactions trigger the correct logic specified in the blueprint?
    7. **Import/Dependency Issues:** Are all imports valid? Are there any missing or incorrectly referenced dependencies? Are they correct for the specific version installed?
    8. **Library version issues:** Are you sure the code written is compatible with the installed version of the library? (e.g., Tailwind v3 vs. v4)
    9. **Especially lookout for setState inside render or without dependencies**
        - Mentally simulate the linting rule \`react-hooks/exhaustive-deps\`.

    **Method:**
    •   Review file-by-file, considering its dependencies and dependents.
    •   Mentally simulate user flows described in the blueprint.
    •   Cross-reference implementation against the \`description\`, \`userFlow\`, \`components\`, \`dataFlow\`, and \`implementationDetails\` sections *constantly*.
    •   Pay *extreme* attention to declaration order within scopes.
    •   Check for any imports that are not defined, installed or are not in the template.
    •   Come up with a the most important and urgent issues to fix first. We will run code reviews in multiple iterations, so focus on the most important issues first.

    IF there are any runtime errors or linting errors provided, focus on fixing them first and foremost. No need to provide any minor fixes or improvements to the code. Just focus on fixing the errors.

</REVIEW FOCUS & METHODOLOGY>

<ISSUES TO REPORT (Answer these based on your review):>
    1.  **Functionality Mismatch:** Does the codebase *fail* to deliver any core functionality described in the blueprint? (Yes/No + Specific examples)
    2.  **Logic Errors:** Are there flaws in the application logic (state transitions, calculations, game rules, etc.) compared to the blueprint? (Yes/No + Specific examples)
    3.  **Interaction Failures:** Do user interactions (clicks, inputs) behave incorrectly based on blueprint requirements? (Yes/No + Specific examples)
    4.  **Data Flow Problems:** Is data not flowing correctly between components or managed incorrectly? (Yes/No + Specific examples)
    5.  **State Management Issues:** Does state management lead to incorrect application behavior or UI? (Yes/No + Specific examples)
    6.  **UI Rendering Bugs:** Are there specific rendering issues (layout, alignment, spacing, overlap, responsiveness)? (Yes/No + Specific examples of files/components and issues)
    7.  **Performance Bottlenecks:** Are there obvious performance issues (e.g., inefficient loops, excessive re-renders)? (Yes/No + Specific examples)
    8.  **UI/UX Quality:** Is the UI significantly different from the blueprint's description or generally poor/unusable (ignoring minor aesthetics)? (Yes/No + Specific examples)
    9.  **Runtime Error Potential:** Identify specific code sections highly likely to cause runtime errors (TDZ, undefined properties, bad imports, syntax errors etc.). (Yes/No + Specific examples)
    10. **Dependency/Import Issues:** Are there any invalid imports or usage of non-existent/uninstalled dependencies? (Yes/No + Specific examples)

    If issues pertain to just dependencies not being installed, please only suggest the necessary \`bun add\` commands to install them. Do not suggest file level fixes.
</ISSUES TO REPORT (Answer these based on your review):>

**Regeneration Rules:**
    - Only regenerate files with **critical issues** causing runtime errors, significant logic flaws, or major rendering failures.
    - **Exception:** Small UI/CSS files *can* be regenerated for styling/alignment fixes if needed.
    - Do **not** regenerate for minor formatting or non-critical stylistic preferences.
    - Do **not** make major refactors or architectural changes.

<INSTRUCTIONS>
    Do not spend much time on this phase. If you find any critical issues, just fix them and move on, we will have thorough code reviews in the next phases.
    Do not make major changes to the code. Just focus on fixing the critical issues and bugs.
</INSTRUCTIONS>

This phase prepares the code for final deployment.`;

const formatTechnicalInstructions = (instructions?: TechnicalInstructionType | null): string => {
    if (!instructions || instructions.instructions.length === 0 || instructions === null) {
        return '';
    }
    
    return `<USER TECHNICAL INSTRUCTIONS>
**Priority Level**: ${instructions.priority.toUpperCase()}

**Technical Instructions to Integrate**:
${instructions.instructions.map((instruction, index) => `${index + 1}. ${instruction}`).join('\n')}

**Files That May Be Affected**: ${instructions.affectedFiles.length > 0 ? instructions.affectedFiles.join(', ') : 'No specific files identified'}

**Integration Approach**: Merge these instructions with the phase concepts below. Ensure that both the phase goals AND the user's technical requirements are addressed in your implementation.

**IMPORTANT INTEGRATION NOTES:**
- These technical instructions are derived from user feedback and suggestions
- Integrate these instructions WITH the phase concepts, not instead of them
- If instructions conflict with phase goals, prioritize architectural consistency while finding creative solutions
- Focus on high-priority instructions first, then incorporate medium/low priority as feasible
- Ensure all affected files mentioned in instructions are considered for updates
</USER TECHNICAL INSTRUCTIONS>`;
};

const userPropmtFormatter = (phaseConcept: PhaseConceptType, issues: IssueReport, technicalInstructions?: TechnicalInstructionType | null) => {
    const phaseText = TemplateRegistry.markdown.serialize(
        phaseConcept,
        PhaseConceptSchema
    );
    
    const prompt = USER_PROMPT
        .replaceAll('{{phaseText}}', phaseText)
        .replaceAll('{{technicalInstructions}}', formatTechnicalInstructions(technicalInstructions))
        .replaceAll('{{issues}}', issuesPromptFormatter(issues));
    return PROMPT_UTILS.verifyPrompt(prompt);
}

export class PhaseImplementationOperation extends AgentOperation<PhaseImplementationInputs, PhaseImplementationOutputs> {
    async execute(
        inputs: PhaseImplementationInputs,
        options: OperationOptions
    ): Promise<PhaseImplementationOutputs> {
        const { phase, issues, technicalInstructions } = inputs;
        const { env, logger, context } = options;
        
        const instructionsInfo = technicalInstructions 
            ? `with ${technicalInstructions.instructions.length} technical instructions (${technicalInstructions.priority} priority)`
            : "without technical instructions";
            
        logger.info(`Generating files for phase: ${phase.name} ${instructionsInfo}`, phase.description, "files:", phase.files.map(f => f.path));
    
        // Notify phase start
        const codeGenerationFormat = new SCOFFormat();
        // Build messages for generation
        const messages = getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, true);
        messages.push(createUserMessage(userPropmtFormatter(phase, issues, technicalInstructions) + codeGenerationFormat.formatInstructions()));
    
        // Initialize streaming state
        const streamingState: CodeGenerationStreamingState = {
            accumulator: '',
            completedFiles: new Map(),
            parsingState: {} as SCOFParsingState
        };
    
        const fixedFilePromises: Promise<FileOutputType>[] = [];
        
        // // Pre-compute expensive operations outside the callback for efficiency
        // const filesBeingGenerated = new Set(phase.files.map(f => f.path));
        // const allFilesLookup = context.allFiles.reduce((acc, file) => ({ ...acc, [file.file_path]: file }), {});
        
        // // Pre-filter existing files that won't be generated in this phase
        // const existingFilesNotBeingGenerated = context.allFiles
        //     .filter(f => !filesBeingGenerated.has(f.file_path))
        //     .map(f => ({
        //         file_path: f.file_path,
        //         file_contents: f.file_contents,
        //         file_purpose: FileProcessing.findFilePurpose(f.file_path, phase, allFilesLookup)
        //     }));

        let modelConfig = AGENT_CONFIG.phaseImplementation;
        if (inputs.isFirstPhase) {
            modelConfig = AGENT_CONFIG.firstPhaseImplementation;
        }
    
        // Execute inference with streaming
        await executeInference({
            id: options.agentId,    
            env: env,
            agentActionName: "phaseImplementation",
            messages,
            modelConfig,
            stream: {
                chunk_size: 256,
                onChunk: (chunk: string) => {
                    codeGenerationFormat.parseStreamingChunks(
                        chunk,
                        streamingState,
                        // File generation started
                        (file_path: string) => {
                            logger.info(`Starting generation of file: ${file_path}`);
                            inputs.fileGeneratingCallback(file_path, FileProcessing.findFilePurpose(file_path, phase, context.allFiles.reduce((acc, f) => ({ ...acc, [f.file_path]: f }), {})));
                        },
                        // Stream file content chunks
                        (file_path: string, fileChunk: string, format: 'full_content' | 'unified_diff') => {
                            inputs.fileChunkGeneratedCallback(file_path, fileChunk, format);
                        },
                        // onFileClose callback
                        (file_path: string) => {
                            logger.info(`Completed generation of file: ${file_path}`);
                            const completedFile = streamingState.completedFiles.get(file_path);
                            if (!completedFile) {
                                logger.error(`Completed file not found: ${file_path}`);
                                return;
                            }
    
                            // Process the file contents
                            const originalContents = context.allFiles.find(f => f.file_path === file_path)?.file_contents || '';
                            completedFile.file_contents = FileProcessing.processGeneratedFileContents(
                                completedFile,
                                originalContents,
                                logger
                            );
    
                            const generatedFile: FileOutputType = {
                                ...completedFile,
                                file_purpose: FileProcessing.findFilePurpose(
                                    file_path, 
                                    phase, 
                                    context.allFiles.reduce((acc, f) => ({ ...acc, [f.file_path]: f }), {})
                                )
                            };
    
                            // // Build previousFiles efficiently using pre-computed values
                            // // Get files already generated in this phase (excluding current file)
                            // const generatedFilesInPhase = Array.from(streamingState.completedFiles.values())
                            //     .filter(f => f.file_path !== file_path)
                            //     .map(f => ({
                            //         file_path: f.file_path,
                            //         file_contents: f.file_contents,
                            //         file_purpose: FileProcessing.findFilePurpose(f.file_path, phase, allFilesLookup)
                            //     }));
                            
                            // // Combine pre-computed existing files + already generated files for realtime code fixer
                            // const previousFiles = [...existingFilesNotBeingGenerated, ...generatedFilesInPhase];

                            // Call realtime code fixer immediately - this is the "realtime" aspect
                            const realtimeCodeFixer = new RealtimeCodeFixer(env, options.agentId);
                            const fixPromise = realtimeCodeFixer.run(
                                generatedFile, 
                                {
                                    // previousFiles: previousFiles,
                                    query: context.query,
                                    blueprint: context.blueprint,
                                    template: context.templateDetails
                                },
                                phase
                            );

                            // const fixPromise = Promise.resolve(generatedFile);
                            
                            fixedFilePromises.push(fixPromise);
    
                            inputs.fileClosedCallback(generatedFile, `Completed generation of ${file_path}`);
                        }
                    );
                }
            }
        });

        // // Extract commands from the generated files
        // const commands = extractCommands(results.string, true);
        const commands = streamingState.parsingState.extractedInstallCommands;

        logger.info("Files generated for phase:", phase.name, "with", fixedFilePromises.length, "files being fixed in real-time and extracted install commands:", commands);
    
        // Return generated files for validation and deployment
        return {
            // rawFiles: generatedFilesInPhase,
            fixedFilePromises,
            deploymentNeeded: fixedFilePromises.length > 0,
            commands,
        };
    }
}
