import { MessageRole } from '../inferutils/common';
import { TemplateListResponse} from '../../services/sandbox/sandboxTypes';
import z from 'zod';
import { createLogger } from '../../logger';
import { executeInference } from '../inferutils/infer';

const logger = createLogger('TemplateSelector');

// Schema for AI template selection output
export const TemplateSelectionSchema = z.object({
    selectedTemplateName: z.string().nullable().describe('The name of the most suitable template, or null if none are suitable.'),
    reasoning: z.string().describe('Brief explanation for the selection or why no template was chosen.'),
    useCase: z.enum(['SaaS Product Website', 'Dashboard', 'Blog', 'Portfolio', 'E-Commerce', 'General']).describe('The use case for which the template is selected, if applicable.').nullable(),
    complexity: z.enum(['simple', 'moderate', 'complex']).describe('The complexity of developing the project based on the the user query').nullable(),
    styleSelection: z.enum(['Minimalist Design', 'Brutalism', 'Retro', 'Illustrative', 'Kid_Playful']).describe('Pick a style relevant to the user query').nullable(),
    projectName: z.string().describe('The name of the project based on the user query'),
});

export type TemplateSelection = z.infer<typeof TemplateSelectionSchema>;

interface SelectTemplateArgs {
    env: Env;
    agentId: string;
    query: string;
    availableTemplates: TemplateListResponse['templates'];
}

/**
 * Uses AI to select the most suitable template for a given query.
 */
export async function selectTemplate({ env, agentId, query, availableTemplates }: SelectTemplateArgs): Promise<TemplateSelection> {
    if (availableTemplates.length === 0) {
        logger.info("No templates available for selection.");
        return { selectedTemplateName: null, reasoning: "No templates were available to choose from.", useCase: null, complexity: null, styleSelection: null, projectName: '' };
    }

    try {
        logger.info("Asking AI to select a template", { 
            query, 
            queryLength: query.length,
            availableTemplates: availableTemplates.map(t => t.name),
            templateCount: availableTemplates.length 
        });

        const templateDescriptions = availableTemplates.map((t, index) =>
            `- Template #${index + 1} \n Name - ${t.name} \n Language: ${t.language}, Frameworks: ${t.frameworks?.join(', ') || 'None'}\n ${t.description.selection}`
        ).join('\n\n');

        const systemPrompt = `You are an expert software architect specializing in efficient template selection. Your task is to determine if any of the provided project templates are a good starting point for the user's request.

This is a critical decision that will significantly impact development efficiency:
1. Choose the best template that closely matches the user's requirements.
2. Consider tech stack compatibility, application architecture, and required features
3. When multiple templates might work, pick the one requiring the least modification
4. Only return the name of the selected template as is, without any additional formatting, trailing slashes, or quotes
5. Do not assume anything from the template names as they might just be code names, for example 'c-code-react-runner' does not mean its for c code. Infact, it is a react code runner template.
6. Look into the template language and frameworks to see if they are compatible with the user query.
7. Even if no template is a perfect match, select the one that provides most base code and structure for the user query. DO NOT RETURN none or null

For style selection pick a style that suits the project described by the user query.
Options: Minimalist Design, Brutalism, Retro, Illustrative, Kid_Playful

For your selection, provide brief but precise reasoning for why it's a match. Also come up with a suitable and nice project name.`;

        const userPrompt = `User Query: "${query}"

Available Templates:
${templateDescriptions}

Which template (if any) is the most suitable starting point for this query?`;

        const messages = [
            { role: "system" as MessageRole, content: systemPrompt },
            { role: "user" as MessageRole, content: userPrompt }
        ];

        const { object: selection } = await executeInference({
            id: agentId,
            env,
            messages,
            agentActionName: "templateSelection",
            schema: TemplateSelectionSchema,
            maxTokens: 2000,
        });


        logger.info(`AI template selection result: ${selection.selectedTemplateName || 'None'}, Reasoning: ${selection.reasoning}`);
        return selection;

    } catch (error) {
        logger.error("Error during AI template selection:", error);
        // Fallback to no template selection in case of error
        return { selectedTemplateName: null, reasoning: "An error occurred during the template selection process.", useCase: null, complexity: null, styleSelection: null, projectName: '' };
    }
}