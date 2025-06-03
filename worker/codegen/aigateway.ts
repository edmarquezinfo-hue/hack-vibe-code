import OpenAI from "openai";
import z from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { RunnerServiceClient } from "./runnerServiceUtils";

// Define allowed message roles for type safety
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

// Define a proper message type that matches OpenAI's requirements
export type Message = {
    role: MessageRole;
    content: string;
    name?: string; // Optional name field required for function messages
};

type InferArgsBase = {
    env: Env;
    messages: Message[];
    maxTokens?: number;
    modelName: AIModels;
    reasoningEffort?: 'low' | 'medium' | 'high';
    temperature?: number;
    stream?: {
        chunk_size: number;
        onChunk: (chunk: string) => void;
    };
}

export enum AIModels {
    GEMINI_2_5_PRO_PREVIEW_05_06 = 'gemini-2.5-pro-preview-05-06',
    GEMINI_2_5_FLASH_PREVIEW_04_17 = 'gemini-2.5-flash-preview-04-17',
    GEMINI_2_5_FLASH_PREVIEW_05_20 = 'gemini-2.5-flash-preview-05-20',
    GEMINI_1_5_FLASH_8B = 'gemini-1.5-flash-8b-latest',
    CLAUDE_3_5_SONNET_LATEST = 'claude-3-5-sonnet-latest',
    CLAUDE_3_7_SONNET_20250219 = 'claude-3-7-sonnet-20250219',
    OPENAI_O3 = 'o3-2025-04-16',
    OPENAI_O4_MINI = 'o4-mini-2025-04-16',
    OPENAI_4_1 = 'gpt-4.1-2025-04-14',
}

export function infer<OutputSchema extends z.AnyZodObject>(
    args: InferArgsBase & { schema: OutputSchema,  schemaName: string;
    }
): Promise<z.infer<OutputSchema>>;
  
export function infer(
    args: InferArgsBase
  ): Promise<string>;

/**
 * Perform an inference using OpenAI's structured output with JSON schema
 * This uses the response_format.schema parameter to ensure the model returns
 * a response that matches the provided schema.
 */
export async function infer<OutputSchema extends z.AnyZodObject>(
    { env, messages, schema, schemaName, maxTokens, modelName, stream, reasoningEffort, temperature }: InferArgsBase & {
        schema?: OutputSchema;
        schemaName?: string;
    }
): Promise<z.infer<OutputSchema> | string> {
    try {
        /** 1. ————————————————— credentials & baseURL */
        let apiKey = env.OPENAI_API_KEY;
        let baseURL: string | undefined;

        if (modelName.includes("gemini")) {
            apiKey = env.GEMINI_API_KEY;
            baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/";
        } else if (modelName.includes("claude")) {
            // Use inferWithFunctionCalling for function calling
            if (schema && schemaName) {
                return await inferWithFunctionCalling({
                    env,
                    messages,
                    functionName: schemaName,
                    schema,
                    maxTokens,
                    modelName
                });
            } else {
                throw new Error("Schema and schemaName are required to use claude model.");
            }
        }
        if (!apiKey) throw new Error("Missing API key for selected provider.");

        const client = new OpenAI({ apiKey, baseURL });

        console.log(`Running inference with ${modelName} using structured output`);
        const req = `${JSON.stringify(messages, null, 2)}`;
        RunnerServiceClient.writeFileLogs(new Date().valueOf().toString() + "_req.json", req);

        // Call OpenAI API with proper structured output format
        const response = await client.chat.completions.create({
            model: modelName,
            messages: messages as OpenAI.ChatCompletionMessageParam[],
            reasoning_effort: reasoningEffort,
            temperature,
            max_completion_tokens: maxTokens || 150000,
            ...((schema && schemaName) ? { response_format: zodResponseFormat(schema, schemaName) } : {}),
            stream: true
        });

        
        let content = "";
        let streamIndex = 0;
        for await (const event of response) {
            content += event.choices[0]?.delta?.content || "";
            if (stream) {
                const slice = content.slice(streamIndex);
                if (slice.length >= stream.chunk_size || event.choices[0]?.finish_reason !== null) {
                    stream.onChunk(slice);
                    streamIndex += slice.length;
                }
            }
        }

        if (!content) {
            console.error("No content received from OpenAI", JSON.stringify(response, null, 2));
            throw new Error("No content received from OpenAI");
        }

        RunnerServiceClient.writeFileLogs(new Date().valueOf().toString() + "_resp.json", content);

        if(!schema) {
            return content;
        };

        try {
            // Parse the JSON response
            const parsedContent = JSON.parse(content);

            // Use Zod's safeParse for proper error handling
            const result = schema.safeParse(parsedContent);

            if (!result.success) {
                console.error("Schema validation errors:", result.error.format());
                throw new Error(`Failed to validate AI response against schema: ${result.error.message}`);
            }

            return result.data as z.infer<OutputSchema>;
        } catch (parseError) {
            console.error("Error parsing response:", parseError);
            if (parseError instanceof SyntaxError) {
                throw new Error(`Failed to parse AI response as valid JSON: ${parseError.message}`);
            } else {
                throw parseError;
            }
        }
    } catch (error) {
        console.error("Error in inferWithSchemaOutput:", error);
        throw error;
    }
}


type FunctionCallingArgs = {
    env: Env;
    messages: Message[];
    functionName: string;
    schema: z.AnyZodObject;
    maxTokens?: number;
    modelName: string;
}

/**
 * Perform an inference using OpenAI's function calling for structured outputs
 */
export async function inferWithFunctionCalling<OutputSchema extends z.AnyZodObject>(
    { env, messages, functionName, schema, maxTokens, modelName }: FunctionCallingArgs
): Promise<z.infer<OutputSchema>> {
    try {
        /** 1. ————————————————— credentials & baseURL */
        let apiKey = env.OPENAI_API_KEY;
        let baseUrl: string | undefined;

        if (modelName.includes("gemini")) {
            apiKey = env.GEMINI_API_KEY;
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
        } else if (modelName.includes("claude")) {
            // TODO: Handle 
            // apiKey = env.ANTHROPIC_API_KEY;
            baseUrl = "https://api.anthropic.com/v1/";
        }
        if (!apiKey) throw new Error("Missing API key for selected provider.");

        const client = new OpenAI({ apiKey, baseURL: baseUrl });

        console.log(`Running inference with ${modelName} using function calling (${functionName})`);

        // Convert Zod schema to JSON schema and use it directly for the function schema
        const jsonSchema = zodToJsonSchema(schema, {
            $refStrategy: 'none'
        });

        // Create OpenAI function definition with proper type
        const functionDef = {
            name: functionName,
            description: `Generate a ${functionName} based on the user's request`,
            parameters: jsonSchema as Record<string, unknown>
        };

        // Call OpenAI API with function calling
        const response = await client.chat.completions.create({
            model: modelName,
            messages: messages as OpenAI.ChatCompletionMessageParam[],
            tools: [
                {
                    type: "function",
                    function: functionDef
                }
            ],
            tool_choice: {
                type: "function",
                function: { name: functionName }
            },
            max_completion_tokens: maxTokens || 100000,
        });

        // Extract and parse the function call
        const toolCall = response.choices[0]?.message?.tool_calls?.[0];
        if (!toolCall || toolCall.type !== "function" || toolCall.function.name !== functionName) {
            throw new Error("Model did not call the expected function");
        }

        try {
            // Parse the function arguments as JSON
            const functionArgs = JSON.parse(toolCall.function.arguments);

            // Validate with the provided schema
            const result = schema.safeParse(functionArgs);

            if (!result.success) {
                console.error("Schema validation errors:", result.error.format());
                throw new Error(`Failed to validate function call response: ${result.error.message}`);
            }

            return result.data as z.infer<OutputSchema>;
        } catch (parseError) {
            console.error("Error parsing function arguments:", parseError);
            if (parseError instanceof SyntaxError) {
                throw new Error(`Failed to parse function arguments as valid JSON: ${parseError.message}`);
            }
            throw parseError;
        }
    } catch (error) {
        console.error("Error in inferWithFunctionCalling:", error);
        throw error;
    }
}