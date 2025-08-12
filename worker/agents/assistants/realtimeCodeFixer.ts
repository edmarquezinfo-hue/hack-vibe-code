import { TemplateDetails } from "../../services/sandbox/sandboxTypes";
import { createAssistantMessage, createSystemMessage, createUserMessage } from "../inferutils/common";
import { Blueprint, FileOutputType, PhaseConceptType } from "../schemas";
import { createObjectLogger } from "../../logger";
import { executeInference } from "../inferutils/infer";
import { PROMPT_UTILS } from "../prompts";
import Assistant from "./assistant";
import { applySearchReplaceDiff } from "../diff-formats";
import { infer } from "../inferutils/core";
import { MatchingStrategy, FailedBlock } from "../diff-formats/search-replace";
import { AIModels, ModelConfig } from "../inferutils/config";
// import { analyzeTypeScriptFile } from "../../services/code-fixer/analyzer";

export interface RealtimeCodeFixerContext {
    previousFiles?: FileOutputType[];
    query: string;
    blueprint: Blueprint;
    template: TemplateDetails;
}

const SYSTEM_PROMPT = `You are a seasoned, highly experienced code inspection officier and senior full-stack engineer specializing in React and TypeScript. Your task is to review and verify if the provided typescript code file wouldn't cause any runtime infinite rendering loops or critical failures, and provide fixes if any. 
You would only be provided with a single file to review at a time. You are to simulate it's runtime behavior and analyze it for listed issues. Your analysis should be thorough but concise, focusing on critical issues and effective fixes.`
/*
<previous_files>
{{previousFiles}}
</previous_files>


 */
const USER_PROMPT = `================================
Here is some relevant context:
<user_query>
{{query}}
</user_query>

Current project phase **being implemented:**
{{phaseConcept}}

================================

Here's the file you need to review:
<file_to_review>
<file_info>
Path: {{filePath}}
Purpose: {{filePurpose}}
</file_info>

<file_contents>
{{fileContents}}
</file_contents>

{{issues}}

You are only provided with this file to review. Assume all imports are correct and exist.
Please ignore the formatting, indentation, spacing and comments.
</file_to_review>

Review Process:
1. Review **THE FILE PROVIDED FOR REVIEW** i.e <file_to_review>.
2. Analyze the code structure, components, and dependencies.
3. Check code for **only these** critical issues in this priority order:
   a. "Maximum update depth exceeded" errors or infinite rendering loops
   b. Nested Router components
   c. Duplicate definitions
   d. Syntax errors
   e. JSX/TSX Tag mismatches (e.g, missing closing tags)
   f. Undefined variables, values or properties (e.g that can cause \`Cannot read properties of undefined (reading 'some')\`)
   g. Logical issues in business logic
   h. Components not exported
   i. UI functionality problems
   j. Constant reassignments
   k. CSS, UI rendering and misalignment issues
   l. Incomplete code
   m. Type errors, undefined properties or values
   n. Unusual characters

4. Pay special attention to React hooks, particularly useEffect, to prevent infinite loops or excessive re-renders.
5. For each issue, provide a fix that addresses the problem without altering existing behavior, definitions, or parameters.
6. Assume all imports are correct and exist. Do not modify imported code, and assume it's behavior from patterns.
7. If you lack context to understand a part of the code, do not modify it.
8. Ignore indentation, spacing, comments, unused imports/variables/functions, or any code that doesn't affect the functionality of the file. No need to waste time on such things.
9. If a change wouldn't fix anything or change any behaviour, i.e, its unnecessary, Don't suggest it.

Before providing fixes, conduct your analysis in <code_review> tags inside your thinking block. Be concise but thorough:

<code_review>
1. Code structure and components
   - List key components and their purposes
2. Critical issues identified:
   - For each issue, write out the problematic code snippet
3. React hooks analysis:
   - For each useEffect, list out its dependencies
4. Proposed fixes rationale
</code_review>

After your analysis, format each fix as follows:

<fix>
# Brief, one-line comment on the issue

\`\`\`
<<<<<<< SEARCH
[exact lines from current file]
=======
[your intended replacement]
>>>>>>> REPLACE
\`\`\`

# Brief, one-line comment on the fix
</fix>

Important reminders:
- Include all necessary fixes in your output.
- Only provide fixes for the file provided for review i.e <file_to_review>.
- The SEARCH section must exactly match a unique existing block of lines, including white space.
- **Every SEARCH section should be followed by a REPLACE section. The SEARCH section begins with <<<<<<< SEARCH and ends with ===== after which the REPLACE section automatically begins and ends with >>>>>>> REPLACE.**
- Assume internal imports (like shadcn components or ErrorBoundaries) exist.
- Please ignore non functional or non critical issues. You are not doing a code quality check, You are performing code validation and issues that can cause runtime errors.
- Pay extra attention to potential "Maximum update depth exceeded" errors, runtime error causing bugs, JSX/TSX Tag mismatches, logical issues and issues that can cause misalignment of UI components.

If no issues are found, return a blank response.

Your final output should consist only of the fixes formatted as shown, without duplicating or rehashing any of the work you did in the code review section.
{{appendix}}`

const EXTRA_JSX_SPECIFIC =`
<appendix>
The most important class of errors is the "Maximum update depth exceeded" error which you definetly need to identify and fix. 
${PROMPT_UTILS.REACT_RENDER_LOOP_PREVENTION}
</appendix>
`;

const DIFF_FIXER_PROMPT = `You made mistakes in generating the diffs and they failed to match. You need to regenerate them properly.

{{failedBlocksCount}} SEARCH/REPLACE block(s) failed to match!

{{failedBlocks}}

The SEARCH section must exactly match an existing block of lines including all white space, comments, indentation, docstrings, etc.

# The other {{successfulBlocksCount}} SEARCH/REPLACE blocks were applied successfully.
Don't re-send them. Just reply with fixed versions of the failed blocks.

Here is the current file content after the successful blocks were applied:

{{currentContent}}

CRITICAL REQUIREMENTS:
- The SEARCH section must EXACTLY match existing lines in the current file
- Include all whitespace, comments, indentation exactly as they appear
- Find the exact text that exists NOW (after successful blocks were applied)
- Don't change the intended functionality of the REPLACE section
- You may make additional fixes if needed to the current content

Just reply with the corrected SEARCH/REPLACE blocks in this format:

<<<<<<< SEARCH
[exact lines from current file]
=======
[your intended replacement]
>>>>>>> REPLACE`

const userPromptFormatter = (user_prompt: string, query: string, file: FileOutputType, previousFiles?: FileOutputType[], currentPhase?: PhaseConceptType, issues?: string[]) => {
    let prompt = user_prompt
        .replaceAll('{{query}}', query)
        .replaceAll('{{previousFiles}}', previousFiles ? PROMPT_UTILS.serializeFiles(previousFiles) : '')
        .replaceAll('{{filePath}}', file.file_path)
        .replaceAll('{{filePurpose}}', file.file_purpose)
        .replaceAll('{{fileContents}}', file.file_contents)
        .replaceAll('{{phaseConcept}}', currentPhase ? `
Current project phase overview:
<current_phase>
${JSON.stringify(currentPhase, null, 2)}
</current_phase>` : '')
        .replaceAll('{{issues}}', issues ? `
<issues>
Here are some issues that were found via static analysis. These may or may not be false positives:
${issues.join('\n')}
</issues>` : '');
        if(file.file_path.endsWith('.tsx') || file.file_path.endsWith('.jsx')) {
            prompt = prompt.replaceAll('{{appendix}}', EXTRA_JSX_SPECIFIC);
        } else {
            prompt = prompt.replaceAll('{{appendix}}', '');
        }
    return PROMPT_UTILS.verifyPrompt(prompt);
}

const diffPromptFormatter = (currentContent: string, failedBlocks: string, failedBlocksCount: number, successfulBlocksCount: number) => {
    const prompt = DIFF_FIXER_PROMPT
        .replaceAll('{{currentContent}}', currentContent)
        .replaceAll('{{failedBlocks}}', failedBlocks)
        .replaceAll('{{failedBlocksCount}}', failedBlocksCount.toString())
        .replaceAll('{{successfulBlocksCount}}', successfulBlocksCount.toString());
    return PROMPT_UTILS.verifyPrompt(prompt);
}

export class RealtimeCodeFixer extends Assistant<Env> {
    logger = createObjectLogger(this, 'RealtimeCodeFixer');
    lightMode: boolean;
    altPassModelOverride?: string;
    userPrompt: string;
    systemPrompt: string;
    modelConfigOverride?: ModelConfig;

    constructor(
        env: Env,
        agentId: string,
        lightMode: boolean = false,
        altPassModelOverride?: string,// = AIModels.GEMINI_2_5_FLASH,
        modelConfigOverride?: ModelConfig,
        systemPrompt: string = SYSTEM_PROMPT,
        userPrompt: string = USER_PROMPT
    ) {
        super(env, agentId);
        this.lightMode = lightMode;
        this.altPassModelOverride = altPassModelOverride;
        this.userPrompt = userPrompt;
        this.systemPrompt = systemPrompt;
        this.modelConfigOverride = modelConfigOverride;
    }

    async run(
        generatedFile: FileOutputType,
        context: RealtimeCodeFixerContext,
        currentPhase?: PhaseConceptType,
        issues: string[] = [],
        passes: number = 2
    ): Promise<FileOutputType> {
        try {
            // Ignore css or json files or *.config.js
            if (generatedFile.file_path.endsWith('.css') || generatedFile.file_path.endsWith('.json') || generatedFile.file_path.endsWith('.config.js')) {
                this.logger.info(`Skipping realtime code fixer for file: ${generatedFile.file_path}`);
                return generatedFile;
            }

            let content = generatedFile.file_contents;

            this.save([createSystemMessage(this.systemPrompt)]);

            const startTime = Date.now();
            let searchBlocks = -1;
            let i = 0;
            while (searchBlocks !== 0 && i < passes) {
                // Do a static analysis of the file
                // const analysis = await analyzeTypeScriptFile(generatedFile.file_path, content);
                // issues = [...issues, ...analysis.issues.map(issue => JSON.stringify(issue, null, 2))];
                this.logger.info(`Running realtime code fixer for file: ${generatedFile.file_path} (pass ${i + 1}/${passes}), issues: ${JSON.stringify(issues, null, 2)}`);
                const messages = this.save([
                    i === 0 ? createUserMessage(userPromptFormatter(this.userPrompt, context.query, generatedFile, context.previousFiles, currentPhase, issues)) : 
                    createUserMessage(`
Please quickly re-review the entire code for another pass to ensure there are no **critical** issues or bugs remaining and there are no weird unapplied changes or residues (e.g, malformed search/replace blocks or diffs).
**Look out for serious issues that can cause runtime errors, rendering issues, logical bugs, or things that got broken by previous fixes**
**Indentations do not cause issues, Please ignore indentation issues**
**Thoroughly look for \`Maximum update depth exceeded\` and other issues that can crash the app on priority**
**No need to be verbose or descriptive if you dont see any issues! We need to commit this file as soon as possible so don't waste time nit-picking! But it shouldn't break at any cost!**

\`\`\`
${content}
\`\`\`

If you think the file is corrupted or too broken, you can completely rewrite it from scratch and provide the raw code inside the commented out <content> tags as follows:
\`\`\`
//<content>
...code...
//</content>
\`\`\`
**MAKE SURE TO COMMENT THE TAGS AND THERE SHOULD ONLY BE ONE <content> TAG AND IT SHOULD BE CLOSED PROPERLY BY </content> TAG**
This would completely replace the original file contents. Otherwise if you just want to add more patches, You can use the SEARCH-REPLACE blocks as previously described.
Don't be nitpicky, If there are no actual issues, just say "No issues found".
`),
                ]);

                const { string: fixResult } = await executeInference({
                    env: this.env,
                    id: this.agentId,
                    agentActionName: "realtimeCodeFixer",
                    messages,
                    modelName: (i !== 0 && this.altPassModelOverride) || this.lightMode ? this.altPassModelOverride : undefined,
                    temperature: (i !== 0 && this.altPassModelOverride) || this.lightMode ? 0.0 : undefined,
                    reasoning_effort: (i !== 0 && this.altPassModelOverride) || this.lightMode ? 'low' : undefined,
                    modelConfig: this.modelConfigOverride,
                });

                if (!fixResult) {
                    this.logger.warn(`Realtime code fixer returned no fix for file: ${generatedFile.file_path}`);
                    return generatedFile;
                }

                this.save([createAssistantMessage(fixResult)]);

                if (fixResult.includes('<content>')) {
                    // Complete rewrite, extract content between tags
                    const contentMatch = fixResult.match(/<content>([\s\S]*?)<\/content>/);
                    if (contentMatch) {
                        content = contentMatch[1].trim();
                    }
                    searchBlocks = 0;
                    continue;
                }
                
                // Search the number of search blocks in fixResult
                searchBlocks = fixResult.match(/<<<\s+SEARCH/g)?.length ?? 0;

                this.logger.info(`Applied search replace diff to file: ${generatedFile.file_path}
================================================================================
Raw content (pass ${i + 1}, found ${searchBlocks} search blocks): 
${content}
-------------------------
Diff:
${fixResult}
-------------------------`);
                content = await this.applyDiffSafely(content, fixResult);

                this.logger.info(`
-------------------------
final content (pass ${i + 1}): 
${content}
================================================================================
`);
                i++;
            }
            const endTime = Date.now();
            this.logger.info(`Realtime code fixer completed for file: ${generatedFile.file_path} in ${endTime - startTime}ms, found ${searchBlocks} search blocks`);

            return {
                ...generatedFile,
                file_contents: content
            };
        } catch (error) {
            this.logger.error(`Error during realtime code fixer for file ${generatedFile.file_path}:`, error);
        }
        return generatedFile;
    }

    /**
     * Smart diff applier with automatic error correction
     * Simple approach: applies diff, if blocks fail, gives all failed blocks to LLM to fix
     */
    async applyDiffSafely(
        originalContent: string, 
        originalDiff: string, 
        maxRetries: number = 3
    ): Promise<string> {
        if (!originalContent || !originalDiff?.trim()) {
            this.logger.warn('Empty content or diff provided to applyDiffSafely');
            return originalContent;
        }

        this.logger.info('Starting smart diff application...');
        
        try {
            let currentContent = originalContent;
            let currentDiff = originalDiff;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                currentDiff = currentDiff.replaceAll(/^={7}\s*$\n^`{3}\s*$/gm, '>>>>>>> REPLACE\n\`\`\`\n')         // A hack cuz LLM often returns =7 and `3 instead of >>>>> REPLACE
                const searchBlocks = currentDiff.match(/<<<\s+SEARCH/g)?.length ?? 0;
                const replaceBlocks = currentDiff.match(/\s+REPLACE/g)?.length ?? 0;
                if (searchBlocks !== replaceBlocks) {
                    this.logger.warn(`Realtime code fixer returned mismatched search and replace blocks for file, ${searchBlocks} search blocks and ${replaceBlocks} replace blocks`);
                    
                    const correctedDiff = await this.getLLMCorrectedDiff(
                        currentContent, 
                        [],
                        ["Mismatched search and replace blocks"],
                        0
                    );

                    if (!correctedDiff) {
                        this.logger.warn(`❌ Failed to get LLM correction on attempt ${attempt + 1}`);
                        return currentContent; // Return what we have so far
                    }

                    // Use the corrected diff for the next iteration
                    currentDiff = correctedDiff;
                    continue;
                }
                // Apply the current diff
                const result = applySearchReplaceDiff(currentContent, currentDiff, {
                    strict: false,
                    matchingStrategies: [MatchingStrategy.EXACT, MatchingStrategy.WHITESPACE_INSENSITIVE, MatchingStrategy.INDENTATION_PRESERVING, MatchingStrategy.FUZZY],
                    fuzzyThreshold: 0.87
                });

                const { blocksApplied, blocksTotal, blocksFailed, failedBlocks } = result.results;
                this.logger.info(`${attempt === 0 ? 'Initial' : `Retry ${attempt}`} application: ${blocksApplied}/${blocksTotal} blocks applied`);

                // Success - all blocks applied
                if (blocksFailed === 0) {
                    this.logger.info('✅ All blocks applied successfully');
                    return result.content;
                } else {
                    this.logger.warn(`⚠️ ${blocksFailed} blocks still failed after ${attempt} retries.
                        Failed blocks:
                        ${failedBlocks.map((block, i) => `   ${i + 1}. ${block}`).join('\n')}
-------------------------
Failing Diff:
${currentDiff}
-------------------------`);
                }

                // If this was the last attempt, return what we have
                if (attempt === maxRetries) {
                    this.logger.warn(`⚠️ ${blocksFailed} blocks still failed after ${maxRetries} retries`);
                    failedBlocks.forEach((block, i) => {
                        this.logger.warn(`   ${i + 1}. ${block.error}`);
                    });
                    return result.content;
                }

                // Update current content with any successful changes
                currentContent = result.content;

                // Ask LLM to fix all failed blocks
                this.logger.info(`🔄 Getting LLM correction for ${blocksFailed} failed blocks...`);
                
                const correctedDiff = await this.getLLMCorrectedDiff(
                    currentContent, 
                    failedBlocks,
                    result.results.errors,
                    blocksApplied
                );

                if (!correctedDiff) {
                    this.logger.warn(`❌ Failed to get LLM correction on attempt ${attempt + 1}`);
                    return result.content; // Return what we have so far
                }

                // Use the corrected diff for the next iteration
                currentDiff = correctedDiff;
            }

            return currentContent;

        } catch (error) {
            this.logger.error('❌ Error in smart diff application:', error);
            return originalContent;
        }
    }

    /**
     * Get corrected diff from LLM using the new simplified DIFF_FIXER prompt
     */
    async getLLMCorrectedDiff(
        currentContent: string,
        failedBlocks: FailedBlock[],
        allErrors: string[],
        successfullyAppliedCount: number
    ): Promise<string | null> {
        try {
            // Format the failed blocks in the expected format for the new prompt
            const failedBlocksText = failedBlocks.map((block) => 
                `## SearchReplaceNoExactMatch: This SEARCH block failed to exactly match lines in the file
<<<<<<< SEARCH
${block.search}
=======
${block.replace}
>>>>>>> REPLACE

${block.error}
`).join('\n\n');

            // Format all errors as additional context
            const allErrorsText = allErrors.length > 0 ? 
                `\n\nAll cumulative errors from diff application:\n${allErrors.map(err => `- ${err}`).join('\n')}` : 
                '';

            // Use the new simplified DIFF_FIXER prompt
            const diffFixerPrompt = diffPromptFormatter(
                currentContent,
                failedBlocksText + allErrorsText,
                failedBlocks.length,
                successfullyAppliedCount
            );

            this.logger.info(`Getting corrected diff from LLM...${failedBlocksText}`);

            const messages = this.save([createUserMessage(diffFixerPrompt)]); 
            
            const llmResponse = await infer({
                env: this.env,
                id: this.agentId,
                modelName: AIModels.GEMINI_2_5_FLASH,
                reasoning_effort: 'low',
                temperature: 0.1,
                maxTokens: 10000,
                messages,
            });

            if (!llmResponse) {
                this.logger.warn("❌ No LLM response received");
                return null;
            }

            // The new prompt returns corrected diff directly without XML tags
            const trimmed = llmResponse.string.trim();
            
            // Count blocks for validation
            const searchCount = (trimmed.match(/<<<<<<< SEARCH/g) || []).length;
            const replaceCount = (trimmed.match(/>>>>>>> REPLACE/g) || []).length;
            
            if (searchCount !== replaceCount) {
                this.logger.warn(`❌ Mismatched markers: ${searchCount} SEARCH vs ${replaceCount} REPLACE`, trimmed);
                return null;
            }

            if (searchCount === 0) {
                this.logger.warn("❌ No valid search/replace blocks found in LLM response", trimmed);
                return null;
            }

            this.logger.info(`🔄 LLM provided ${searchCount} corrected blocks`);
            return trimmed;

        } catch (error) {
            this.logger.error('❌ Error getting LLM correction:', error);
            return null;
        }
    }

}