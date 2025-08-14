import { PhaseConceptGenerationSchema, PhaseConceptGenerationSchemaType } from '../schemas';
import { IssueReport } from '../domain/values/IssueReport';
import { createUserMessage } from '../inferutils/common';
import { executeInference } from '../inferutils/infer';
import { issuesPromptFormatter, PROMPT_UTILS, STRATEGIES } from '../prompts';
import { Message } from '../inferutils/common';
import { AgentOperation, getSystemPromptWithProjectContext, OperationOptions } from '../operations/common';

export interface PhaseGenerationInputs {
    issues: IssueReport;
    userSuggestions?: string[] | null;
}

const SYSTEM_PROMPT = `<ROLE>
    You are a meticulous and seasoned senior software architect at Cloudflare. You are working on our development team to build high performance, elegant, robust and maintainable web applications for our clients.
    You are responsible for planning and managing the core development process, laying out the development strategy and phases for the project at hand.
</ROLE>

<TASK>
    You are given the blueprint (PRD) and the client query. You would be provided with all the previously implemented project phases, the current latest snapshot of the codebase, and any current runtime issues or static analysis reports.
    Your task is to design the next phase of the project as a milestone leading to the completion of the project.
    The project needs to be fully ready to be shipped in a reasonable amount of time. Please plan accordingly.
    If there are no more phases to be done, you may conclude the process by putting blank fields in the response.
    You are to follow the <PHASES GENERATION STRATEGY> provided as a reference policy we use to build and deliver projects.
    You are not permitted to suggest any changes to the core configuration of the project like package.json, tsconfig.json, etc. directly (except some exceptions such as tailwind.config.js)
</TASK>

<STARTING TEMPLATE>
{{template}}
</STARTING TEMPLATE>

<CLIENT REQUEST>
"{{query}}"
</CLIENT REQUEST>

<BLUEPRINT>
{{blueprint}}
</BLUEPRINT>

<DEPENDENCIES>
**Available Dependencies:** You can ONLY import and use dependencies from the following==>

template dependencies:
{{dependencies}}

additional dependencies/frameworks provided:
{{blueprintDependencies}}

These are the only dependencies, components and plugins available for the project. No other plugin or component or dependency is available.
</DEPENDENCIES>`;

const INITIAL_PHASE_USER_PROMPT = `**GENERATE THE INITIAL PHASE**
Generate the initial phase of the application.
Adhere to the following guidelines: 

<SUGGESTING INITIAL PHASE>
•   Suggest the initial phase based on the blueprint provided, our phase planning strategy and the client query.
•   Thoroughly understand the current codebase (template boilerplate code) and what changes might be required to implement the phase as per the blueprint.
•   Closely follow the <PHASES GENERATION STRATEGY> provided as a reference policy we use to build and deliver projects.
•   The Phase needs to be deployable with all the views/pages working properly!
•   Provide a clear, concise, to the point description of the next phase and the purpose and contents of each file in it.
•   Keep all the description fields very short and concise.
•   Don't think or write too much. Keep everything simple and straight to the point.
</SUGGESTING INITIAL PHASE>`;

const NEXT_PHASE_USER_PROMPT = `**GENERATE THE PHASE**
Generate the next phase of the application.
Adhere to the following guidelines: 

<SUGGESTING NEXT PHASE>
•   Suggest the next phase based on the current progress, the overall application architecture, the blueprint, current runtime errors/bugs and any user suggestions.
•   Please ignore non functional or non critical issues. Your primary task is to suggest project development phases, linting and non-critical issues can be fixed later in code review cycles.
•   Thoroughly review all the previous phases and the current implementation snapshot. Verify the frontend elements, UI, and backend components.
    - **Understand what has been implemented and what remains** We want a full finished product eventually! No feature should be left unimplemented if its possible to implement it using the current dependencies.
    - Each phase should work towards achieving the final product. **ONLY** mark as last phase if you are sure there is no work left to do.
    - If a certain feature can't be implemented due to dependency constraints, use mock data or best possible alternative thats still possible.
    - Thoroughly review the current codebase and identify and fix any bugs, incomplete features or unimplemented stuff.
•   Next phase should cover fixes (if any), development as well as also continue on UI/UX refinement.
•   Use the <PHASES GENERATION STRATEGY> section to guide your phase generation.
•   Ensure the next phase logically and iteratively builds on the previous one.
•   Provide a clear, concise, to the point description of the next phase and the purpose and contents of each file in it.
•   Keep all the description fields very short and concise.
•   If there are any files that were supposed to be generated in the previous phase, but were not, please mention them in the phase description and suggest them in the phase.
•   **Every phase needs to be deployable with all the views/pages working properly!**
</SUGGESTING NEXT PHASE>

Always remember our strategy for phase generation: 
${STRATEGIES.FRONTEND_FIRST_PLANNING}

<DONT_TOUCH_FILES>
**STRICTLY DO NOT TOUCH THESE FILES**
- "wrangler.jsonc"
- "wrangler.toml"
- "donttouch_files.json"
- ".important_files.json"
- "worker/index.ts"
- "worker/core-utils.ts"

These files are very critical and redacted for security reasons. Don't modify the worker bindings the core-utils or the worker index file.
</DONT_TOUCH_FILES>

{{issues}}

{{userSuggestions}}`;

const formatUserSuggestions = (suggestions?: string[] | null): string => {
    if (!suggestions || suggestions.length === 0) {
        return '';
    }
    
    return `
<USER SUGGESTIONS>
The following client suggestions and feedback have been provided for the **phase before the last phase**
Please incorporate these suggestions **on priority** (if they are still relevant) into your phase planning:

**Client Feedback & Suggestions**:
${suggestions.map((suggestion, index) => `${index + 1}. ${suggestion}`).join('\n')}

**IMPORTANT**: These suggestions should be considered alongside the project's natural progression. If the project is mostly finished, just focus on implementing the suggestions.
If any suggestions conflict with architectural patterns or project goals, prioritize architectural consistency while finding creative ways to address user needs.
Consider these suggestions when planning the files, components, and features for this phase.
Try to make small targeted, isolated changes to the codebase to address the user's suggestions unless a complete rework is required.
</USER SUGGESTIONS>`;
};

const userPropmtFormatter = (issues: IssueReport, userSuggestions?: string[] | null) => {
    const prompt = NEXT_PHASE_USER_PROMPT
        .replaceAll('{{issues}}', issuesPromptFormatter(issues))
        .replaceAll('{{userSuggestions}}', formatUserSuggestions(userSuggestions));
    return PROMPT_UTILS.verifyPrompt(prompt);
}

export class PhaseGenerationOperation extends AgentOperation<PhaseGenerationInputs, PhaseConceptGenerationSchemaType> {
    async generateInitialPhase(options: OperationOptions) {
        const { env, logger, context } = options;
        try {
            logger.info("Generating initial phase");
            const messages: Message[] = [
                ...getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, false),
                createUserMessage(INITIAL_PHASE_USER_PROMPT)
            ];
            const { object: results } = await executeInference({
                id: options.agentId,
                env: env,
                messages,
                agentActionName: "phaseGeneration",
                schema: PhaseConceptGenerationSchema,
                // format: 'markdown',
            });

            if (results) {
                // Filter and remove any pdf files
                results.files = results.files.filter(f => !f.path.endsWith('.pdf'));
            }
    
            logger.info(`Generated initial phase: ${results.name}, ${results.description}`);
    
            return results;
        } catch (error) {
            logger.error("Error generating initial phase:", error);
            throw error;
        }
    }

    async execute(
        inputs: PhaseGenerationInputs,
        options: OperationOptions
    ): Promise<PhaseConceptGenerationSchemaType> {
        const { issues, userSuggestions } = inputs;
        const { env, logger, context } = options;
        try {
            const suggestionsInfo = userSuggestions && userSuggestions.length > 0
                ? `with ${userSuggestions.length} user suggestions`
                : "without user suggestions";
            
            logger.info(`Generating next phase ${suggestionsInfo}`);
    
            const messages: Message[] = [
                ...getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, false),
                createUserMessage(userPropmtFormatter(issues, userSuggestions))
            ];
    
            const { object: results } = await executeInference({
                id: options.agentId,
                env: env,
                messages,
                agentActionName: "phaseGeneration",
                schema: PhaseConceptGenerationSchema,
                format: 'markdown',
            });
    
            logger.info(`Generated next phase: ${results.name}, ${results.description}`);
    
            return results;
        } catch (error) {
            logger.error("Error generating next phase:", error);
            throw error;
        }
    }
}