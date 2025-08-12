import { TechnicalInstructionSchema, TechnicalInstructionType } from '../schemas';
import { createUserMessage } from '../inferutils/common';
import { executeInference } from '../inferutils/infer';
import { PROMPT_UTILS } from '../prompts';
import { AgentOperation, getSystemPromptWithProjectContext, OperationOptions } from '../operations/common';
import { IssueReport } from '../domain/values/IssueReport';

export interface UserSuggestionProcessorInputs {
    suggestions: string[];
    issues: IssueReport;
}

const SYSTEM_PROMPT = `<ROLE>
You are a Senior Technical Architect at Cloudflare specializing in translating user requirements into precise technical implementation guidance.

Your expertise lies in:
- Analyzing user feedback and feature requests in the context of existing codebases
- Generating targeted, isolated, and DRY technical change instructions
- Maintaining architectural consistency and code quality standards
- Ensuring changes align with project goals and technical constraints
</ROLE>

<GOAL>
Transform user suggestions and feedback into actionable technical instructions for the development team. 
Your instructions will guide phase implementation to incorporate user requirements effectively.

IMPORTANT CONSTRAINTS:
- Generate INSTRUCTIONS only, never actual code
- Follow DRY principles rigorously  
- Keep instructions targeted and isolated
- Consider existing project architecture and patterns
- Prioritize changes based on user intent and technical impact
</GOAL>

<CONTEXT>
You will receive user suggestions along with full project context including:
- Original user query and project blueprint
- Current codebase snapshot and generated files
- Runtime issues and static analysis reports
- Project dependencies and template information

Your instructions will be merged with phase concepts during implementation.
</CONTEXT>

<TECHNICAL INSTRUCTION GUIDELINES>
1. **Specificity**: Provide clear, unambiguous instructions for what needs to change
2. **Isolation**: Each instruction should be self-contained and not depend on others
3. **DRY Compliance**: Ensure instructions promote code reuse and avoid duplication
4. **Architectural Alignment**: Instructions should fit existing project patterns
5. **Prioritization**: Mark high-priority items that directly address user needs
6. **File Awareness**: Identify which files may need modifications

Example Instruction Format:
- "Update the navigation component to include a user profile dropdown in the header"
- "Add form validation logic to the contact form with proper error message display"
- "Implement responsive design patterns for mobile viewport in the dashboard layout"
</TECHNICAL INSTRUCTION GUIDELINES>

<CLIENT REQUEST>
"{{query}}"
</CLIENT REQUEST>

<BLUEPRINT>
{{blueprint}}
</BLUEPRINT>

<DEPENDENCIES>
**Available Dependencies:**

template dependencies:
{{dependencies}}

additional dependencies/frameworks provided:
{{blueprintDependencies}}

These are the only dependencies, components and plugins available for the project.
</DEPENDENCIES>

<TEMPLATE_DETAILS>
{{template}}
</TEMPLATE_DETAILS>`;

const USER_PROMPT = `**ANALYZE USER SUGGESTIONS AND GENERATE TECHNICAL INSTRUCTIONS**

<USER SUGGESTIONS TO PROCESS>
{{userSuggestions}}
</USER SUGGESTIONS TO PROCESS>

<CURRENT PROJECT ISSUES>
<RUNTIME ERRORS>
{{runtimeErrors}}
</RUNTIME ERRORS>

<STATIC ANALYSIS ISSUES>
{{staticAnalysis}}
</STATIC ANALYSIS ISSUES>

<CLIENT REPORTED ERRORS>
{{clientErrors}}
</CLIENT REPORTED ERRORS>
</CURRENT PROJECT ISSUES>

**INSTRUCTIONS FOR PROCESSING:**

1. **Analyze User Intent**: Understand what the user is trying to achieve with their suggestions
2. **Consider Project Context**: Review current codebase, issues, and architectural patterns
3. **Generate Targeted Instructions**: Create specific, actionable instructions that address user needs
4. **Prioritize Changes**: Determine which changes are high, medium, or low priority based on:
   - Direct user impact
   - Technical complexity
   - Alignment with project goals
   - Risk of breaking existing functionality

5. **Identify Affected Files**: List file paths that may need modification to implement these instructions

**OUTPUT REQUIREMENTS:**
- Provide clear, concise technical instructions (NO CODE)
- Each instruction should be implementable independently
- Follow DRY principles and existing project patterns
- Specify priority levels appropriately
- List affected file paths for each instruction set

If no actionable instructions can be derived from the user suggestions, return an empty instructions array.`;

const formatUserPrompt = (inputs: UserSuggestionProcessorInputs): string => {
    const userSuggestions = inputs.suggestions.join('\n\n---\n\n');
    const issues = inputs.issues;
    
    return USER_PROMPT
        .replaceAll('{{userSuggestions}}', userSuggestions || 'No pending user suggestions')
        .replaceAll('{{runtimeErrors}}', PROMPT_UTILS.serializeErrors(issues.runtimeErrors || []))
        .replaceAll('{{staticAnalysis}}', PROMPT_UTILS.serializeStaticAnalysis(issues.staticAnalysis))
        .replaceAll('{{clientErrors}}', PROMPT_UTILS.serializeClientReportedErrors(issues.clientErrors || []));
};

export class UserSuggestionProcessor extends AgentOperation<UserSuggestionProcessorInputs, TechnicalInstructionType> {
    async execute(
        inputs: UserSuggestionProcessorInputs,
        options: OperationOptions
    ): Promise<TechnicalInstructionType> {
        const { suggestions } = inputs;
        const { env, logger, context } = options;

        // If no user suggestions, return empty instructions
        if (!suggestions || suggestions.length === 0) {
            logger.info("No user suggestions to process");
            return {
                instructions: [],
                priority: 'low',
                affectedFiles: []
            };
        }

        try {
            logger.info(`Processing user suggestions ${suggestions}`);

            // Notify processing start
            // broadcaster!.broadcast(WebSocketMessageResponses.USER_SUGGESTIONS_PROCESSING, {
            //     message: "Analyzing user suggestions and generating technical instructions",
            //     suggestions
            // });

            const messages = [
                ...getSystemPromptWithProjectContext(SYSTEM_PROMPT, context, false),
                createUserMessage(formatUserPrompt(inputs))
            ];

            const { object: result } = await executeInference({
                id: options.agentId,
                env: env,
                messages,
                agentActionName: "userSuggestionProcessor",
                schema: TechnicalInstructionSchema,
                format: 'markdown',
            });

            if (!result) {
                logger.warn("Failed to generate technical instructions from user suggestions");
                return {
                    instructions: [],
                    priority: 'low',
                    affectedFiles: []
                };
            }

            logger.info("Generated technical instructions", {
                instructionCount: result.instructions.length,
                priority: result.priority,
                affectedFileCount: result.affectedFiles.length
            });

            // Notify processing complete
            // broadcaster!.broadcast(WebSocketMessageResponses.USER_SUGGESTIONS_PROCESSED, {
            //     message: `Generated ${result.instructions.length} technical instructions from user suggestions`,
            //     ...result
            // });

            return result;
        } catch (error) {
            logger.error("Error processing user suggestions:", error);
            // Return empty instructions on error
            throw error;
        }
    }
}