import { createSystemMessage, createUserMessage } from '../inferutils/common';
import { executeInference } from '../inferutils/infer';
import { PROMPT_UTILS } from '../prompts';
import { AgentOperation, OperationOptions } from '../operations/common';
import { FileOutputType, PhaseConceptType } from '../schemas';
import { SCOFFormat } from '../code-formats/scof';
import { CodeIssue } from '../../services/sandbox/sandboxTypes';

export interface FastCodeFixerInputs {
    query: string;
    issues: CodeIssue[];
    allFiles: FileOutputType[];
    allPhases?: PhaseConceptType[];
}

const SYSTEM_PROMPT = `You are a senior software engineer at Cloudflare, currently on our Incident response team. There may have been several potential issues identified in our codebase. You are to thoroughly review and fix them.`
const USER_PROMPT = `
================================
Here is the codebase of the project:
<codebase>
{{codebase}}
</codebase>

This was the original project request from our client:
<client_request>
{{query}}
</client_request>

Identified issues:
<issues>
{{issues}}
</issues>
================================

**TASK:**
Identify if the issues aren't false positives and need attention, and then fix them file by file, providing output in our special code formatting scheme.

**Patching Guidelines:**
    •   Analyze the code structure, components, and dependencies.
    •   **Targeted Fixes:** Address *only* the identified problems. Do not refactor unrelated code or introduce new features.
    •   **Preserve Functionality:** Ensure the corrected code still fulfills the file's original purpose and maintains its interface (exports) for other files. Ensure all the functions/components still have correct and compatible specifications **Do NOT break working parts.**
    •   **Quality Standards:** Apply the same high standards as initial generation (clean code, define-before-use, valid imports, etc.). Refer to <SYSTEM_PROMPTS.CODE_GENERATION>.
    •   **Dependency Constraints:** Use ONLY existing dependencies (<DEPENDENCIES>). Only touch imports if they are obviously wrong.
    •   **Verification:** Mentally verify your fix addresses the issues without introducing regressions. Check for syntax errors, TDZ, etc.
    •   **No Placeholders:** Write production ready code. No \`// TODO\`, commented-out blocks, examples, or non-functional placeholders. Include necessary initial/default states or data structures for the app to load correctly.
    •   **No comments**: Do not add any comments to the code. Just Fix the issues.

Important reminders:
    - Include all necessary fixes in your output.    
    - Pay extra attention to potential "Maximum update depth exceeded" errors, runtime error causing bugs, JSX/TSX Tag mismatches, logical issues and issues that can cause misalignment of UI components.

To fix a file, simply rewrite it's entire contents in the output format provided
`

const userPromptFormatter = (query: string, issues: CodeIssue[], allFiles: FileOutputType[], _allPhases?: PhaseConceptType[]) => {
    const prompt = USER_PROMPT
        .replaceAll('{{query}}', query)
        .replaceAll('{{issues}}', JSON.stringify(issues, null, 2))
        .replaceAll('{{codebase}}', PROMPT_UTILS.serializeFiles(allFiles));
    return PROMPT_UTILS.verifyPrompt(prompt);
}

export class FastCodeFixerOperation extends AgentOperation<FastCodeFixerInputs, FileOutputType[]> {
    async execute(
        inputs: FastCodeFixerInputs,
        options: OperationOptions
    ): Promise<FileOutputType[]> {
        const { query, issues, allFiles, allPhases } = inputs;
        const { env, logger } = options;
        
        logger.info(`Fixing issues for ${allFiles.length} files`);

        const userPrompt = userPromptFormatter(query, issues, allFiles, allPhases);
        const systemPrompt = SYSTEM_PROMPT;
        const codeGenerationFormat = new SCOFFormat();

        const messages = [
            createSystemMessage(systemPrompt),
            createUserMessage(userPrompt + codeGenerationFormat.formatInstructions())
        ];

        const result = await executeInference({
            id: options.agentId,    
            env: env,
            messages,
            agentActionName: "fastCodeFixer",
        });

        const files = codeGenerationFormat.deserialize(result.string);
        return files;
    }
}
