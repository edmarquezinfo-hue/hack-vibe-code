import { FileGenerationOutputType } from '../schemas';
import { AgentOperation, OperationOptions } from '../operations/common';
import { RealtimeCodeFixer } from '../assistants/realtimeCodeFixer';
import { FileOutputType } from '../schemas';
import { WebSocketMessageResponses } from '../constants';
import { AGENT_CONFIG } from '../config';

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
{{issues}}

**TASK:**
Rewrite the code for \`{{filePath}}\` to fix **all** the specific issues listed above while preserving all existing, correct functionality and adhering to the original application requirements.

**Patching Guidelines:**
    •   **Targeted Fixes:** Address *only* the identified problems. Do not refactor unrelated code or introduce new features.
    •   **Preserve Functionality:** Ensure the corrected code still fulfills the file's original purpose and maintains its interface (exports) for other files. Ensure all the functions/components still have correct and compatible specifications **Do NOT break working parts.**
    •   **Quality Standards:** Apply the same high standards as initial generation (clean code, define-before-use, valid imports, etc.). Refer to <SYSTEM_PROMPTS.CODE_GENERATION>.
    •   **Dependency Constraints:** Use ONLY existing dependencies (<DEPENDENCIES>). Do not add imports for new libraries or ungenerated files.
    •   **Verification:** Mentally verify your fix addresses the issues without introducing regressions. Check for syntax errors, TDZ, etc.
    •   **No Placeholders:** Write production ready code. No \`// TODO\`, commented-out blocks, examples, or non-functional placeholders. Include necessary initial/default states or data structures for the app to load correctly.
    •   **No comments**: Do not add any comments to the code. Just Fix the issues.

Format each fix as follows:

<fix>
# Brief, one-line comment on the issue

\`\`\`
<<<<<<< SEARCH
[original code]
=======
[fixed code]
>>>>>>> REPLACE
\`\`\`
</fix>
    
Important reminders:
    - Include all necessary fixes in your output.
    - Only provide fixes for the file provided for review i.e <file_to_review>.
    - The SEARCH section must exactly match a unique existing block of lines, including white space.
    - **Every SEARCH section should be followed by a REPLACE section. The SEARCH section begins with <<<<<<< SEARCH and ends with ===== after which the REPLACE section automatically begins and ends with >>>>>>> REPLACE.**
    - Assume internal imports (like shadcn components or ErrorBoundaries) exist.
    - Pay extra attention to potential "Maximum update depth exceeded" errors, runtime error causing bugs, JSX/TSX Tag mismatches, logical issues and issues that can cause misalignment of UI components.
    - Only make the fixes for the issues provided in the <issues> tag. Do not think much of try to find and fix other issues.

Your final output should consist only of the fixes formatted as shown`;

export class FileRegenerationOperation extends AgentOperation<FileRegenerationInputs, FileGenerationOutputType> {    
    async execute(
        inputs: FileRegenerationInputs,
        options: OperationOptions
    ): Promise<FileGenerationOutputType> {
        try {
            options.broadcaster?.broadcast(WebSocketMessageResponses.FILE_REGENERATING, {
                message: `Regenerating file: ${inputs.file.file_path}`,
                file_path: inputs.file.file_path,
                original_issues: inputs.issues,
            });
            
            // Use realtime code fixer to fix the file
            const realtimeCodeFixer = new RealtimeCodeFixer(options.env, options.agentId, false, undefined, AGENT_CONFIG.fileRegeneration, USER_PROMPT);
            const fixedFile = await realtimeCodeFixer.run(
                inputs.file, {
                    previousFiles: options.context.allFiles,
                    query: options.context.query,
                    blueprint: options.context.blueprint,
                    template: options.context.templateDetails
                },
                undefined,
                inputs.issues,
            );

            options.broadcaster?.broadcast(WebSocketMessageResponses.FILE_REGENERATED, {
                message: `Regenerated file: ${inputs.file.file_path}`,
                file: fixedFile,
                original_issues: inputs.issues,
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
