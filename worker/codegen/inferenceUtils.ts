import { AIModels, infer, Message } from './aigateway';
import { Blueprint } from './blueprint';
import { SYSTEM_PROMPT_FORMATTER, USER_PROMPT_FORMATTER} from './prompts';
import { createSystemMessage, createUserMessage, formatFileTree } from './utils';
import z from 'zod';
import { RuntimeError, TemplateDetailsResponse } from './runnerServiceTypes';
import { createLogger } from '../utils/logger';

const logger = createLogger('InferenceUtils');

/**
 * Helper function to execute AI inference with consistent error handling
 * @param params Parameters for the inference operation
 * @returns The inference result or null if error
 */
export async function executeInferenceSchema<T extends z.AnyZodObject>({
    env,
    messages,
    schema,
    schemaName,
    maxTokens = 500000, // Keep the high token limit for Gemini
    modelName = AIModels.GEMINI_2_5_PRO_PREVIEW_05_06,
    operationName,
    retryLimit = 5, // Increased retry limit for better reliability
    onChunk,
    reasoningEffort,
}: {
    env: Env;
    messages: Message[];
    schema: T;
    schemaName: string;
    maxTokens?: number;
    modelName?: AIModels;
    operationName: string;
    reasoningEffort?: "high" | "medium" | "low";
    retryLimit?: number;
    onChunk?: ((chunk: string) => void);
}): Promise<z.infer<T> | null> {
    // Exponential backoff for retries
    const backoffMs = (attempt: number) => Math.min(100 * Math.pow(2, attempt), 10000);
    
    for (let attempt = 0; attempt < retryLimit; attempt++) {
        try {
            logger.info(`Starting ${operationName} operation with model ${modelName} (attempt ${attempt + 1}/${retryLimit})`);
    
            const result = await infer({
                env,
                messages,
                schema,
                schemaName,
                maxTokens,
                reasoningEffort,
                modelName,
                ...(onChunk ? { stream: {
                    onChunk,
                    chunk_size: 512,
                }} : {}),
            });
            logger.info(`Successfully completed ${operationName} operation`);
            return result;
        } catch (error) {
            const isLastAttempt = attempt === retryLimit - 1;
            logger.info(
                `Error during ${operationName} operation (attempt ${attempt + 1}/${retryLimit}):`, 
                error
            );
            
            if (!isLastAttempt) {
                // Wait with exponential backoff before retrying
                const delay = backoffMs(attempt);
                logger.info(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    return null;
}

/**
 * Helper function to execute AI inference with consistent error handling
 * @param params Parameters for the inference operation
 * @returns The inference result or null if error
 */
export async function executeInference({
    env,
    messages,
    maxTokens = 500000, // Keep the high token limit for Gemini
    modelName = AIModels.GEMINI_2_5_PRO_PREVIEW_05_06, // Keep using Gemini as preferred model
    reasoningEffort,
    operationName,
    retryLimit = 5, // Increased retry limit for better reliability
    onChunk,
}: {
    env: Env;
    messages: Message[];
    maxTokens?: number;
    modelName?: AIModels;
    operationName: string;
    retryLimit?: number;
    reasoningEffort?: "high" | "medium" | "low";
    onChunk?: ((chunk: string) => void);
}): Promise<string | null> {
    // Exponential backoff for retries
    const backoffMs = (attempt: number) => Math.min(100 * Math.pow(2, attempt), 10000);
    
    for (let attempt = 0; attempt < retryLimit; attempt++) {
        try {
            logger.info(`Starting ${operationName} operation with model ${modelName} (attempt ${attempt + 1}/${retryLimit})`);
    
            const result = await infer({
                env,
                messages,
                maxTokens,
                modelName,
                reasoningEffort,
                ...(onChunk ? { stream: {
                    onChunk,
                    chunk_size: 512,
                }} : {}),
            });
            logger.info(`Successfully completed ${operationName} operation`);
            return result;
        } catch (error) {
            const isLastAttempt = attempt === retryLimit - 1;
            logger.warn(
                `Error during ${operationName} operation (attempt ${attempt + 1}/${retryLimit}):`, 
                error
            );
            
            if (!isLastAttempt) {
                // Wait with exponential backoff before retrying
                const delay = backoffMs(attempt);
                logger.warn(`Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    return null;
}

type StrippedBlueprint = Omit<Blueprint, 'fileStructure' | 'commands'> & {
    fileStructure: Array<{
        path: string;
        purpose: string;
        dependencies: string[];
    }>;
} & { commands?: unknown };

export function createCodeGenerationSystemMessage(
    query: string,
    blueprint: Blueprint,
    templateDetails?: TemplateDetailsResponse['templateDetails'],
): Message {
        // Use the system prompt and blue print to generate the initial context
        const blueprintCopy: StrippedBlueprint = { ...blueprint };
        delete blueprintCopy.commands;
        blueprintCopy.fileStructure = blueprintCopy.fileStructure.map(file => ({
            path: file.path,
            purpose: file.purpose,
            dependencies: file.dependencies,
        }));
        const blueprintText = JSON.stringify(blueprint, null, 2);

        let promptTemplateDetails = '';
        if (templateDetails) {
            const formattedTemplateDetails = templateDetails;
            formattedTemplateDetails.fileTree = formatFileTree(templateDetails.fileTree);

            promptTemplateDetails = `
<TEMPLATE DETAILS>
The following are the details (structures and files) of the template that would be used in the runtime as base for the project. Your code may overwrite the files in the template.

${JSON.stringify(formattedTemplateDetails, null, 2)}

<TEMPLATE MODIFICATION INSTRUCTIONS>
Pay special attention to the version of libraries and frameworks used in the template. They cannot be changed.
You cannot modify critical files such as package.json, vite.config.js, tsconfig.json, etc.
`;
        }
    const systemPrompt = SYSTEM_PROMPT_FORMATTER.CODE_GENERATION(
        query,
        blueprintText,
        promptTemplateDetails,
    )
    return createSystemMessage(systemPrompt);
}

export function createCodeReviewRequestSystemtMessage(
    query: string,
    blueprint: Blueprint,
    templateDetails?: TemplateDetailsResponse['templateDetails'],
    errors?: RuntimeError[],
): Message {
    // Use the system prompt and blue print to generate the initial context
    const blueprintText = JSON.stringify(blueprint, null, 2);

    let promptTemplateDetails = '';
    if (templateDetails) {
        promptTemplateDetails = JSON.stringify(templateDetails, null, 2)
    }
    let errorsText = '';
    if (errors) {
        errorsText = JSON.stringify(errors, null, 2);
    }
    const systemPrompt = SYSTEM_PROMPT_FORMATTER.CODE_REVIEW(
        query,
        blueprintText,
        promptTemplateDetails,
        errorsText,
    )
    return createSystemMessage(systemPrompt);
}

export function createUpdateProjectRequestSystemMessage(
    query: string,
    blueprint: Blueprint,
): Message {
    // Use the system prompt and blue print to generate the initial context
    const blueprintText = JSON.stringify(blueprint, null, 2);
    const systemPrompt = SYSTEM_PROMPT_FORMATTER.UPDATE_PROJECT(
        query,
        blueprintText,
    )
    return createSystemMessage(systemPrompt);
}

/**
 * Creates a file generation request message
 */
export function createFileGenerationRequestMessage(file: Blueprint['fileStructure'][0]): Message {
    const content = USER_PROMPT_FORMATTER.CODE_GENERATION(file);

    return createUserMessage(content);
}

/**
 * Creates a response message about a generated file
 */
export function createFileGenerationResponseMessage(filePath: string, fileContents: string, explanation: string, nextFile?: {path: string, purpose: string}): Message {
    // Format the message in a focused way to reduce token usage
    const fileExtension = filePath.split('.').pop() || '';
    const codeBlock = fileExtension ? 
        `\`\`\`${fileExtension}\n${fileContents}\n\`\`\`` : 
        `\`\`\`\n${fileContents}\n\`\`\``;
        
    return {
        role: 'assistant',
        content: `
<FILE GENERATED PREVIOUSLY: "${filePath}">
${codeBlock}

Explanation: ${explanation}
${nextFile && `Next file to generate: Path: ${nextFile.path} | Purpose: (${nextFile.purpose})`}
`};
}