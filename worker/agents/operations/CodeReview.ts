import { CodeReviewOutputType, CodeReviewOutput , FileOutputSchema } from '../schemas';
import { GenerationContext } from '../domain/values/GenerationContext';
import { IssueReport } from '../domain/values/IssueReport';
import { createSystemMessage, createUserMessage } from '../inferutils/common';
import { executeInference } from '../inferutils/infer';
import { generalSystemPromptBuilder, issuesPromptFormatter, PROMPT_UTILS } from '../prompts';
import { TemplateRegistry } from '../inferutils/schemaFormatters';
import { z } from 'zod';
import { AgentOperation, OperationOptions } from '../operations/common';

export interface CodeReviewInputs {
    issues: IssueReport
}

const SYSTEM_PROMPT = `You are a Senior Software Engineer at Cloudflare specializing in code quality assurance and bug detection. Your task is to review AI-generated code and identify critical issues that prevent proper functionality.

## PRIORITY ORDER (Fix in this exact order):
1. **Runtime Errors** - Syntax errors, undefined variables, bad imports, TDZ issues
2. **Logic Errors** - Incorrect application behavior vs blueprint requirements  
3. **UI Rendering Issues** - Layout problems, missing elements, styling errors
4. **State Management Bugs** - Infinite loops, incorrect state updates

## EXAMPLE REVIEWS:

**Example 1 - Runtime Error:**
ISSUE: Runtime Error in src/components/GameBoard.tsx:15
PROBLEM: Accessing 'undefined.length' when gameState is undefined
FIX: Add null check: if (!gameState?.moves) return null;
PRIORITY: Critical - Will crash app

**Example 2 - Logic Error:**
ISSUE: Logic Error in src/utils/scoring.ts:28
PROBLEM: Score calculation uses addition instead of multiplication as per blueprint
FIX: Change 'baseScore + multiplier' to 'baseScore * multiplier'
PRIORITY: High - Incorrect game behavior

**Example 3 - UI Rendering:**
ISSUE: UI Rendering in src/components/Header.tsx:42
PROBLEM: Missing responsive classes causing mobile layout break
FIX: Add 'md:flex-row flex-col' to container div
PRIORITY: Medium - Poor mobile experience

## OUTPUT FORMAT:
For each issue found, use this exact format:
- **ISSUE:** [Category] in [file:line]
- **PROBLEM:** [Brief description]
- **FIX:** [Specific solution]
- **PRIORITY:** [Critical/High/Medium]

## CONSTRAINTS:
- Focus ONLY on blocking issues
- Provide specific file paths and line numbers when possible
- Suggest fixes within existing dependencies only
- If only missing dependencies, suggest 'bun add [package]' commands

${PROMPT_UTILS.COMMANDS}

## COMMON PATTERNS TO AVOID:
${PROMPT_UTILS.COMMON_PITFALLS}
${PROMPT_UTILS.REACT_RENDER_LOOP_PREVENTION} 

<CLIENT REQUEST>
"{{query}}"
</CLIENT REQUEST>

<BLUEPRINT>
{{blueprint}}
</BLUEPRINT>

<DEPENDENCIES>
These are the dependencies that came installed in the environment:
{{dependencies}}

If anything else is used in the project, make sure it is installed in the environment
</DEPENDENCIES>

{{template}}`;

const USER_PROMPT = `
{{issues}}

<ENTIRE CODEBASE>
{{context}}
</ENTIRE CODEBASE>

<FINAL INSTRUCTION>
    Analyze the provided code thoroughly. Identify all critical issues preventing correct functionality or rendering based on the blueprint. Provide concise, actionable fixes for each issue identified.
    Please ignore and don't report unnecessary issues such as 'prefer-const', 'no-unused-vars', etc.
    Remember: All the fixes suggested by you would be made by AI Agents running in parallel. Thus fixes requiring changes across multiple files need to be suggested with detailed instructions as context won't be shared between agents.
</FINAL INSTRUCTION>`;

const userPromptFormatter = (issues: IssueReport, context: string) => {
    const prompt = USER_PROMPT
        .replaceAll('{{issues}}', issuesPromptFormatter(issues))
        .replaceAll('{{context}}', context);
    return PROMPT_UTILS.verifyPrompt(prompt);
}

export class CodeReviewOperation extends AgentOperation<CodeReviewInputs, CodeReviewOutputType> {
    async execute(
        inputs: CodeReviewInputs,
        options: OperationOptions
    ): Promise<CodeReviewOutputType> {
        const { issues } = inputs;
        const { env, logger, context } = options;
        
        logger.info("Performing code review");
        logger.info("Running static code analysis via linting...");

        if (issues.runtimeErrors.length > 0) {
            logger.info(`Found ${issues.runtimeErrors.length} runtime errors, will include in code review: ${issues.runtimeErrors.map(e => e.message).join(', ')}`);
        }

        // Get files context
        const filesContext = getFilesContext(context);

        const messages = [
            createSystemMessage(generalSystemPromptBuilder(SYSTEM_PROMPT, {
                query: context.query,
                blueprint: context.blueprint,
                templateDetails: context.templateDetails,
                dependencies: context.dependencies,
                forCodegen: true
            })),
            createUserMessage(userPromptFormatter(issues, filesContext)),
        ];

        try {
            const { object: reviewResult } = await executeInference({
                env: env,
                messages,
                schema: CodeReviewOutput,
                agentActionName: "codeReview",
                context: options.inferenceContext,
                reasoning_effort: issues.runtimeErrors.length || issues.staticAnalysis.lint.issues.length || issues.staticAnalysis.typecheck.issues.length > 0 ? undefined : 'low',
                // format: 'markdown'
            });

            if (!reviewResult) {
                throw new Error("Failed to get code review result");
            }
            return reviewResult;
        } catch (error) {
            logger.error("Error during code review:", error);
            throw error;
        }
    }
}

/**
 * Get files context for review
 */
function getFilesContext(context: GenerationContext): string {
    const files = context.allFiles;
    const filesObject = { files };

    return TemplateRegistry.markdown.serialize(
        filesObject,
        z.object({
            files: z.array(FileOutputSchema)
        })
    );
}