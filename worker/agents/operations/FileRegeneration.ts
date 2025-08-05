import { FileGenerationOutput, FileGenerationOutputType } from '../schemas';
import { createUserMessage } from '../inferutils/common';
import { executeInference } from '../inferutils/inferenceUtils';
import { PROMPT_UTILS } from '../prompts';
import { FileProcessing } from '../domain/pure/FileProcessing';
import { WebSocketMessageResponses } from '../constants';
import { AgentOperation, getSystemPromptWithProjectContext, OperationOptions } from '../operations/common';
import { SCOFFormat } from '../code-formats/scof';
import { SYSTEM_PROMPT } from './PhaseImplementation';

export interface FileRegenerationInputs {
    filePath: string;
    filePurpose: string;
    issueDescription: string;
    retryIndex: number;
}

const USER_PROMPT = `<PATCH FILE: {{filePath}}>

**Identified Issues Requiring Patch:**
\`\`\`
{{issues}}
\`\`\`

**TASK:**
Rewrite the code for \`{{filePath}}\` to fix **all** the specific issues listed above while preserving all existing, correct functionality and adhering to the original application requirements.

**Patching Guidelines:**
    •   **Targeted Fixes:** Address *only* the identified problems. Do not refactor unrelated code or introduce new features.
    •   **Preserve Functionality:** Ensure the corrected code still fulfills the file's original purpose and maintains its interface (exports) for other files. Ensure all the functions/components still have correct and compatible specifications **Do NOT break working parts.**
    •   **Quality Standards:** Apply the same high standards as initial generation (clean code, define-before-use, valid imports, etc.). Refer to <SYSTEM_PROMPTS.CODE_GENERATION>.
    •   **Dependency Constraints:** Use ONLY existing dependencies (<DEPENDENCIES>). Do not add imports for new libraries or ungenerated files.
    •   **Verification:** Mentally verify your fix addresses the issues without introducing regressions. Check for syntax errors, TDZ, etc.
    •   **No Placeholders:** Generate complete, final code. No \`// TODO\`, commented-out blocks, examples, or non-functional placeholders. Include necessary initial/default states or data structures for the app to load correctly.
    •   **No comments**: Do not add any comments to the code. Just Fix the issues.


${PROMPT_UTILS.CODE_CONTENT_FORMAT}

**Reference:**
<ORIGINAL FILE PATH>
{{filePath}}
</ORIGINAL FILE PATH>

<ORIGINAL FILE PURPOSE>
{{fileExplanation}}
</ORIGINAL FILE PURPOSE>

<ORIGINAL FILE CONTENTS>
\`\`\`
{{fileContents}}
\`\`\`
</ORIGINAL FILE CONTENTS>`;

const userPromptFormatter = (filePath: string, fileContents: string, fileExplanation: string, issues: string) => {
    const prompt = USER_PROMPT
        .replaceAll('{{filePath}}', filePath)
        .replaceAll('{{fileContents}}', fileContents)
        .replaceAll('{{fileExplanation}}', fileExplanation)
        .replaceAll('{{issues}}', issues);
    return PROMPT_UTILS.verifyPrompt(prompt);
}

export class FileRegenerationOperation extends AgentOperation<FileRegenerationInputs, FileGenerationOutputType> {
    async execute(
        inputs: FileRegenerationInputs,
        options: OperationOptions
    ): Promise<FileGenerationOutputType> {
        const { filePath, filePurpose, issueDescription, retryIndex } = inputs;
        const { env, broadcaster, logger, context, fileManager } = options;
        logger.info(`Regenerating file: ${filePath} due to issues: ${issueDescription}`);
    
        broadcaster!.broadcast(WebSocketMessageResponses.FILE_GENERATING, {
            file_path: filePath,
            file_purpose: filePurpose,
            is_regeneration: true,
            issue: issueDescription
        });
        const fileToRegenerate = context.allFiles.find(file => file.file_path === filePath);
        if (!fileToRegenerate) {
            logger.error(`File to regenerate not found: ${filePath}`);
            throw new Error(`File not found: ${filePath}`);
        }
    
        // Build messages for generation
        const codeGenerationFormat = new SCOFFormat();
        const messages = getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, true);
        messages.push(createUserMessage(userPromptFormatter(
            filePath,
            fileToRegenerate.file_contents,
            fileToRegenerate.file_purpose,
            issueDescription
        ) + codeGenerationFormat.formatInstructions()));

        try {
            const { object: regeneratedFile } = await executeInference({
                id: options.agentId,
                env: env,
                messages,
                schema: FileGenerationOutput,
                schemaName: "fileRegeneration",
                operationName: `File regeneration for ${filePath}`,
                // format: "markdown",
                retryLimit: 5
            });
    
            if (!regeneratedFile || !regeneratedFile.file_contents || regeneratedFile.file_contents.trim() === '') {
                logger.error(`Failed to regenerate file: ${filePath}`);
                
                if (retryIndex >= 3) {
                    broadcaster!.broadcast(WebSocketMessageResponses.ERROR, {
                        error: `Failed to regenerate file ${filePath} after multiple attempts`
                    });
                    throw new Error(`Failed to regenerate file ${filePath} after multiple attempts`);
                }
                
                // Retry with incremented index
                // return regenerateFile(filePath, filePurpose, issueDescription, context, env, fileManager, broadcaster, logger, retryIndex + 1);
                return this.execute({
                    filePath,
                    filePurpose,
                    issueDescription,
                    retryIndex: retryIndex + 1
                }, options);
            }
    
            // Process the regenerated file contents
            const originalContents = context.allFiles.find(f => f.file_path === filePath)?.file_contents || '';
            const newFileContents = FileProcessing.processGeneratedFileContents(
                regeneratedFile,
                originalContents,
                logger
            );
    
            const finalFile: FileGenerationOutputType = {
                ...regeneratedFile,
                file_contents: newFileContents,
                format: "full_content"
            };

            // const realtimeCodeFixer = new RealtimeCodeFixer(env, options.agentId, true);
            // const finalFile = await realtimeCodeFixer.run(newFile, {
            //     previousFiles: context.allFiles,
            //     query: context.query,
            //     blueprint: context.blueprint,
            //     template: context.templateDetails
            // });
    
            logger.info(`File regenerated successfully: ${filePath}`);
    
            // Save the regenerated file
            fileManager!.saveGeneratedFile(finalFile);
    
            // Notify successful regeneration
            broadcaster!.broadcast(WebSocketMessageResponses.FILE_REGENERATED, {
                file: finalFile,
                original_issues: issueDescription
            });
    
            return {
                ...finalFile,
                format: "full_content"
            };
        } catch (error) {
            logger.error(`Error regenerating file ${filePath}:`, error);
            broadcaster!.broadcast(WebSocketMessageResponses.ERROR, {
                error: `Error regenerating file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
            });
            throw error;
        }
    }
}
