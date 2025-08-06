import { FileGenerationOutputType } from '../schemas';
import { PROMPT_UTILS } from '../prompts';
import { AgentOperation, OperationOptions } from '../operations/common';
import { RealtimeCodeFixer } from '../assistants/realtimeCodeFixer';
import { AIModels } from '../inferutils/aigateway';
import { FileOutputType } from '../schemas';

export interface FileRegenerationInputs {
    file: FileOutputType;
    issues: string[];
    retryIndex: number;
}

const USER_PROMPT = `<PATCH FILE: {{filePath}}>
================================
Here is some relevant context:
<user_query>
{{query}}
</user_query>

You are only provided with this file to review.
================================

Here's the file you need to review and fix:
<file_to_review>
<file_info>
Path: {{filePath}}
Purpose: {{filePurpose}}
</file_info>

<file_contents>
{{fileContents}}
</file_contents>
</file_to_review>

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


${PROMPT_UTILS.CODE_CONTENT_FORMAT}`;

export class FileRegenerationOperation extends AgentOperation<FileRegenerationInputs, FileGenerationOutputType> {    
    async execute(
        inputs: FileRegenerationInputs,
        options: OperationOptions
    ): Promise<FileGenerationOutputType> {
        try {
            // Use realtime code fixer to fix the file
            const realtimeCodeFixer = new RealtimeCodeFixer(options.env, options.agentId, false, AIModels.GEMINI_2_5_FLASH, USER_PROMPT);
            const fixedFile = await realtimeCodeFixer.run(inputs.file, {
                previousFiles: options.context.allFiles,
                query: options.context.query,
                blueprint: options.context.blueprint,
                template: options.context.templateDetails
            });
            return {
                ...fixedFile,
                format: "full_content"
            };
        } catch (error) {
            throw error;
        }
    }
}
