import { TemplateDetails } from "../../services/sandbox/sandboxTypes";
import { FileOutputType, SetupCommandsType, type Blueprint } from "../schemas";
import { createObjectLogger, StructuredLogger } from '../../logger';
import { generalSystemPromptBuilder, PROMPT_UTILS } from '../prompts';
import { createAssistantMessage, createSystemMessage, createUserMessage } from "../inferutils/common";
import { executeInference, } from "../inferutils/infer";
import Assistant from "./assistant";
import { AIModels, InferenceContext } from "../inferutils/config.types";
import { extractCommands } from "../utils/common";

interface GenerateSetupCommandsArgs {
    env: Env;
    agentId: string;
    query: string;
    blueprint: Blueprint;
    template: TemplateDetails;
    inferenceContext: InferenceContext;
}

const SYSTEM_PROMPT = `You are an Expert senior full-stack engineer at Cloudflare tasked with designing and developing a full stack application for the user based on their original query and provided blueprint. `

const SETUP_USER_PROMPT = `<TASK>
Your current task is to go through the blueprint and user's original query, and setup the inital project - install dependencies etc.
Suggest a list of commands to setup or install dependencies that are required for the project and are not already setup or installed in the project's starting template.
Please thoroughly review and go through the starting template and the blueprint to make the decision. 
Think and come up with all the dependencies that may be required, better install them than forgetting to install and leading to errors.
You may also suggest other common dependencies that are used along with the other dependencies, such as class-variance-authority etc
    - Make sure that everything needed for the project as outlined by the provided blueprint (and optionally template) is setup (either already in the starting template, or to be installed by you)
    - Dependencies need to be suggested with specific major version, and they should all be compatible with each other.
    - Install the latest of the major version you choose for each dependency
</TASK>

<INSTRUCTIONS>
    - Be very specific, focused, targeted and concise
    - All frameworks or dependencies listed in the blueprint need to be installed.
    - Use \`bun add\` to install dependencies, do not use \`npm install\` or \`yarn add\` or \`pnpm add\`.
    - Do not remove or uninstall any dependencies that are already installed.

    - Make sure there are no version conflicts.
        For example, 
            • **@react-three/fiber ^9.0.0 and @react-three/drei ^10.0.0 require react ^19 and will not work with react ^18.**
                - Please upgrade react to 19 to use these packages.
</INSTRUCTIONS>

${PROMPT_UTILS.COMMANDS}

<INPUT DATA>
<QUERY>
{{query}}
</QUERY>

<BLUEPRINT>
{{blueprint}}
</BLUEPRINT>

<STARTING TEMPLATE>
{{template}}

These are the only dependencies installed currently
{{dependencies}}
</STARTING TEMPLATE>

You need to make sure **ALL THESE** are installed at the least:
{{blueprintDependencies}}

</INPUT DATA>`;

const README_GENERATION_PROMPT = `<TASK>
Generate a comprehensive README.md file for this project based on the provided blueprint and template information.
The README should be professional, well-structured, and provide clear instructions for users and developers.
</TASK>

<INSTRUCTIONS>
- Create a professional README with proper markdown formatting
- Include project title, description, and key features from the blueprint
- Add technology stack section based on the template dependencies
- Include setup/installation instructions using bun (not npm/yarn)
- Add usage examples and development instructions
- Include a deployment section with Cloudflare-specific instructions
- **IMPORTANT**: Add a [CloudflareButton] placeholder in the deployment section for the Cloudflare deploy button
- Structure the content clearly with appropriate headers and sections
- Be concise but comprehensive - focus on essential information
- Use professional tone suitable for open source projects
</INSTRUCTIONS>

Generate the complete README.md content in markdown format. Do not provide any additional text or explanation. All your would be directly saved in the README.md file.`;

export class ProjectSetupAssistant extends Assistant<Env> {
    private query: string;
    private logger: StructuredLogger;
    private inferenceContext: InferenceContext;
    
    constructor({
        env,
        agentId,
        query,
        blueprint,
        template,
        inferenceContext
    }: GenerateSetupCommandsArgs) {
        const systemPrompt = createSystemMessage(SYSTEM_PROMPT);
        super(env, agentId, systemPrompt);
        this.save([createUserMessage(generalSystemPromptBuilder(SETUP_USER_PROMPT, {
            query,
            blueprint,
            templateDetails: template,
            dependencies: template.deps,
            forCodegen: false
        }))]);
        this.query = query;
        this.logger = createObjectLogger(this, 'ProjectSetupAssistant');
        this.inferenceContext = inferenceContext;
    }

    async generateSetupCommands(error?: string): Promise<SetupCommandsType> {
        this.logger.info("Generating setup commands", { query: this.query, queryLength: this.query.length });
    
        try {
            let userPrompt = createUserMessage(`Now please suggest required setup commands for the project, inside markdown code fence`);
            if (error) {
                this.logger.info(`Regenerating setup commands after error: ${error}`);
                userPrompt = createUserMessage(`Some of the previous commands you generated might not have worked. Please review these and generate new commands if required, maybe try a different version or correct the name?
                    
${error}`);
                this.logger.info(`Regenerating setup commands with new prompt: ${userPrompt.content}`);
            }
            const messages = this.save([userPrompt]);

            const results = await executeInference({
                env: this.env,
                messages,
                agentActionName: "projectSetup",
                context: this.inferenceContext,
                modelName: error? AIModels.GEMINI_2_5_FLASH : undefined,
            });
            if (!results || typeof results !== 'string') {
                this.logger.info(`Failed to generate setup commands, results: ${results}`);
                return { commands: [] };
            }

            this.logger.info(`Generated setup commands: ${results}`);

            this.save([createAssistantMessage(results)]);
            return { commands: extractCommands(results) };
        } catch (error) {
            this.logger.error("Error generating setup commands:", error);
            throw error;
        }
    }

    async generateReadme(existingReadme?: { filePath: string; fileContents: string }): Promise<FileOutputType> {
        this.logger.info("Generating README.md for the project");

        try {
            let readmePrompt = README_GENERATION_PROMPT;
            
            if (existingReadme) {
                // Modify prompt for updating existing README
                readmePrompt = `Please update the existing README.md file`
                this.logger.info('Updating existing README.md');
            } else {
                this.logger.info('Creating new README.md');
            }

            const messages = this.save([createUserMessage(readmePrompt)]);

            const results = await executeInference({
                env: this.env,
                messages,
                agentActionName: "projectSetup",
                context: this.inferenceContext,
            });

            if (!results || !results.string) {
                this.logger.error('Failed to generate README.md content');
                throw new Error('Failed to generate README.md content');
            }

            this.logger.info('Generated README.md content successfully');

            this.save([createAssistantMessage(results.string)]);

            return {
                filePath: 'README.md',
                fileContents: results.string,
                filePurpose: 'Project documentation and setup instructions'
            };
        } catch (error) {
            this.logger.error("Error generating README:", error);
            throw error;
        }
    }
}