import { TemplateDetails } from "../../services/sandbox/sandboxTypes";
import { FileOutputType, SetupCommandsType, type Blueprint } from "../schemas";
import { createObjectLogger, StructuredLogger } from '../../logger';
import { generalSystemPromptBuilder, PROMPT_UTILS } from '../prompts';
import { createAssistantMessage, createSystemMessage, createUserMessage } from "../inferutils/common";
import { executeInference } from "../inferutils/infer";
import Assistant from "./assistant";
import { AIModels } from "../inferutils/config";
import { extractCommands } from "../utils/common";

interface GenerateSetupCommandsArgs {
    env: Env;
    agentId: string;
    query: string;
    blueprint: Blueprint;
    template: TemplateDetails;
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


const ENSURE_USER_PROMPT = `The following includes were added/modified to the project. Identify any dependencies that they use and are not installed and provide the commands to install them.
======================================================
{{codebase}}
======================================================
Currently installed dependencies:
{{dependencies}}
======================================================
Just provide the \`bun add\` commands to install the dependencies in markdown code fence, do not provide any explanation or additional text.
Example:
\`\`\`sh
bun add react@18
bun add react-dom@18
\`\`\``;

function extractAllIncludes(files: FileOutputType[]) {
    // Extract out all lines that start with #include or require or import
    const includes = files.flatMap(file => {
        return file.file_contents.split('\n').filter(line => line.startsWith('#include') || line.startsWith('require') || line.startsWith('import'));
    });
    return includes;
}

export class ProjectSetupAssistant extends Assistant<Env> {
    private query: string;
    private logger: StructuredLogger;
    
    constructor({
        env,
        agentId,
        query,
        blueprint,
        template
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
                id: this.agentId,
                messages,
                agentActionName: "projectSetup",
                modelName: error? AIModels.GEMINI_2_5_FLASH : undefined,
            });
            if (!results.string) {
                this.logger.info(`Failed to generate setup commands`);
                return { commands: [] };
            }

            this.logger.info(`Generated setup commands: ${results.string}`);

            this.save([createAssistantMessage(results.string)]);
            return { commands: extractCommands(results.string) };
        } catch (error) {
            this.logger.error("Error generating setup commands:", error);
            throw error;
        }
    }

    async ensureDependencies(allFiles: FileOutputType[], currentDependencies: Record<string, string>) : Promise<SetupCommandsType> {
        this.logger.info("Ensuring dependencies are installed for the current project.");
        try {
            const prompt = ENSURE_USER_PROMPT
            // .replaceAll("{{codebase}}", PROMPT_UTILS.serializeFiles(allFiles))
            .replaceAll("{{codebase}}", extractAllIncludes(allFiles).join('\n'))
            .replaceAll("{{dependencies}}", JSON.stringify(currentDependencies));
            // const messages = this.save([createUserMessage(prompt)]);
            const messages = [...this.getHistory(), createUserMessage(prompt)];     // Don't save the message to avoid context overflow
            // Instead, save [REDACTED] for the codebase
            this.save([createUserMessage(ENSURE_USER_PROMPT.replaceAll("{{codebase}}", "[REDACTED]").replaceAll("{{dependencies}}", "[REDACTED]"))]);
            const results = await executeInference({
                env: this.env,
                id: this.agentId,
                messages,
                agentActionName: "projectSetup",
            });
            if (!results) {
                this.logger.info(`Failed to generate setup commands`);
                return { commands: [] };
            }

            this.logger.info(`Generated setup commands: ${results.string}`);

            this.save([createAssistantMessage(results.string)]); 
            return { commands: extractCommands(results.string) };
        } catch (error) {
            this.logger.error("Error ensuring dependencies:", error);
            throw error;
        }
    }
}