import { OpenAI } from 'openai';
import { Stream } from 'openai/streaming';
import { z } from 'zod';
import {
	type SchemaFormat,
	type FormatterOptions,
	generateTemplateForSchema,
	parseContentForSchema,
} from './schemaFormatters';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';
import {
    ChatCompletionMessageFunctionToolCall,
	ChatCompletionTool,
	type ReasoningEffort,
} from 'openai/resources.mjs';
import { Message, MessageContent, MessageRole } from './common';
import { ToolCall } from '../tools/types';
import { executeTool } from '../tools/customTools';

export enum AIModels {
	GEMINI_2_5_PRO = 'google-ai-studio/gemini-2.5-pro',
	GEMINI_2_5_FLASH = 'google-ai-studio/gemini-2.5-flash',
	GEMINI_2_5_FLASH_PREVIEW = 'google-ai-studio/gemini-2.5-flash-preview-05-20',
	GEMINI_2_5_FLASH_LITE = 'gemini-2.5-flash-lite-preview-06-17',
	GEMINI_2_5_PRO_PREVIEW_05_06 = 'google-ai-studio/gemini-2.5-pro-preview-05-06',
	GEMINI_2_5_FLASH_PREVIEW_04_17 = 'google-ai-studio/gemini-2.5-flash-preview-04-17',
	GEMINI_2_5_FLASH_PREVIEW_05_20 = 'google-ai-studio/gemini-2.5-flash-preview-05-20',
	GEMINI_2_5_PRO_PREVIEW_06_05 = 'google-ai-studio/gemini-2.5-pro-preview-06-05',
	GEMINI_2_5_PRO_PREVIEW = 'google-ai-studio/gemini-2.5-pro-preview-06-05',
	GEMINI_2_0_FLASH = 'google-ai-studio/gemini-2.0-flash',
	GEMINI_1_5_FLASH_8B = 'google-ai-studio/gemini-1.5-flash-8b-latest',
	CLAUDE_3_5_SONNET_LATEST = 'anthropic/claude-3-5-sonnet-latest',
	CLAUDE_3_7_SONNET_20250219 = 'anthropic/claude-3-7-sonnet-20250219',
	CLAUDE_4_OPUS = 'anthropic/claude-opus-4-20250514',
	CLAUDE_4_SONNET = 'anthropic/claude-sonnet-4-20250514',
	OPENAI_O3 = 'o3',
	OPENAI_O4_MINI = 'openai/o4-mini',
	OPENAI_CHATGPT_4O_LATEST = 'openai/chatgpt-4o-latest',
	OPENAI_4_1 = 'openai/gpt-4.1-2025-04-14',
    OPENAI_5 = 'openai/gpt-5',
    OPENAI_5_MINI = 'openai/gpt-5-mini',
    OPENAI_OSS = 'openai/gpt-oss-120b',

    QWEN_3_CODER = 'qwen/qwen3-coder',
    KIMI_2_5 = 'moonshotai/kimi-k2',

    // Cerebras models
    CEREBRAS_GPT_OSS = 'cerebras/gpt-oss-120b',
    CEREBRAS_QWEN_3_CODER = 'cerebras/qwen-3-coder-480b',
}

function optimizeInputs(messages: Message[]): Message[] {
	return messages.map((message) => ({
		...message,
		content: optimizeMessageContent(message.content),
	}));
}

function optimizeMessageContent(content: MessageContent): MessageContent {
    if (!content) return content;
	// If content is an array (TextContent | ImageContent), only optimize text content
	if (Array.isArray(content)) {
		return content.map((item) =>
			item.type === 'text'
				? { ...item, text: optimizeTextContent(item.text) }
				: item,
		);
	}

	// If content is a string, optimize it directly
	return optimizeTextContent(content);
}

function optimizeTextContent(content: string): string {
	// CONSERVATIVE OPTIMIZATION - Only safe changes that preserve readability

	// 1. Remove trailing whitespace from lines (always safe)
	content = content.replace(/[ \t]+$/gm, '');

	// 2. Reduce excessive empty lines (more than 3 consecutive) to 2 max
	// This preserves intentional spacing while removing truly excessive gaps
	content = content.replace(/\n\s*\n\s*\n\s*\n+/g, '\n\n\n');

	// // Convert 4-space indentation to 2-space for non-Python/YAML content
	// content = content.replace(/^( {4})+/gm, (match) =>
	// 	'  '.repeat(match.length / 4),
	// );

	// // Convert 8-space indentation to 2-space
	// content = content.replace(/^( {8})+/gm, (match) =>
	// 	'  '.repeat(match.length / 8),
	// );
	// 4. Remove leading/trailing whitespace from the entire content
	// (but preserve internal structure)
	content = content.trim();

	return content;
}

type InferArgsBase = {
	env: Env;
    id: string;
	messages: Message[];
	maxTokens?: number;
	modelName: AIModels | string;
	reasoning_effort?: ReasoningEffort;
	temperature?: number;
	stream?: {
		chunk_size: number;
		onChunk: (chunk: string) => void;
	};
	tools?: ChatCompletionTool[];
	providerOverride?: 'cloudflare' | 'direct';
};

type InferArgsStructured = InferArgsBase & {
	schema: z.AnyZodObject;
	schemaName: string;
};

type InferWithCustomFormatArgs = InferArgsStructured & {
	format?: SchemaFormat;
	formatOptions?: FormatterOptions;
};
export class InferError extends Error {
	constructor(
		message: string,
		public partialResponse?: string,
	) {
		super(message);
		this.name = 'InferError';
	}
}

const claude_thinking_budget_tokens = {
	medium: 8000,
	high: 16000,
	low: 4000,
    minimal: 1000,
};

export type InferResponseObject<OutputSchema extends z.AnyZodObject> = {
	object: z.infer<OutputSchema>;
	toolCalls?: ToolCall[];
};

export type InferResponseString = {
	string: string;
	toolCalls?: ToolCall[];
};

/**
 * Execute all tool calls from OpenAI response
 */
async function executeToolCalls(openAiToolCalls: ChatCompletionMessageFunctionToolCall[]): Promise<ToolCall[]> {
    return Promise.all(
        openAiToolCalls.map(async (tc) => {
            try {
                const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
                const result = await executeTool(tc.function.name, args);
                console.log(`Tool execution result for ${tc.function.name}:`, result);
                return {
                    id: tc.id,
                    name: tc.function.name,
                    arguments: args,
                    result
                };
            } catch (error) {
                console.error(`Tool execution failed for ${tc.function.name}:`, error);
                return {
                    id: tc.id,
                    name: tc.function.name,
                    arguments: {},
                    result: { error: `Failed to execute ${tc.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}` }
            };
            }
        })
    );
}
export function infer<OutputSchema extends z.AnyZodObject>(
	args: InferArgsStructured,
): Promise<InferResponseObject<OutputSchema>>;

export function infer(args: InferArgsBase): Promise<InferResponseString>;

export function infer<OutputSchema extends z.AnyZodObject>(
	args: InferWithCustomFormatArgs,
): Promise<InferResponseObject<OutputSchema>>;

/**
 * Perform an inference using OpenAI's structured output with JSON schema
 * This uses the response_format.schema parameter to ensure the model returns
 * a response that matches the provided schema.
 */
export async function infer<OutputSchema extends z.AnyZodObject>({
	env,
	id,
	messages,
	schema,
	schemaName,
	format,
	formatOptions,
	maxTokens,
	modelName,
	stream,
	tools,
	reasoning_effort,
	temperature,
	providerOverride,
}: InferArgsBase & {
	schema?: OutputSchema;
	schemaName?: string;
	format?: SchemaFormat;
	formatOptions?: FormatterOptions;
}): Promise<InferResponseObject<OutputSchema> | InferResponseString> {
	try {
		/** 1. ————————————————— credentials & baseURL */
		let apiKey = env.CF_AI_API_KEY as string;
		let baseUrl: string | undefined = env.CF_AI_BASE_URL;

		if (!baseUrl || providerOverride === 'direct' || modelName === 'o3') {
			console.log(
				`Baseurl: ${baseUrl}, Provider override: ${providerOverride}, Model name: ${modelName}`,
			);
			apiKey = env.OPENAI_API_KEY;
			baseUrl = undefined;
			// If a baseurl override is not present, do the default thing
			if (modelName.startsWith('gemini')) {
				apiKey = env.GEMINI_API_KEY;
				baseUrl =
					'https://generativelanguage.googleapis.com/v1beta/openai/';
			} else if (modelName.startsWith('claude')) {
				apiKey = env.ANTHROPIC_API_KEY;
				baseUrl = 'https://api.anthropic.com/v1/';
			} else if (modelName.includes('/')) {
				apiKey = env.OPENROUTER_API_KEY;
				baseUrl = 'https://openrouter.ai/api/v1';
			}
		}
		if (!apiKey) throw new Error(`Missing API key for selected provider: ${modelName}, baseUrl: ${baseUrl}, providerOverride: ${providerOverride}`);

		console.log(`baseUrl: ${baseUrl}, providerOverride: ${providerOverride}, modelName: ${modelName}`);

        

		const client = new OpenAI({ apiKey, baseURL: baseUrl });
		const schemaObj =
			schema && schemaName && !format
				? { response_format: zodResponseFormat(schema, schemaName) }
				: {};
		const extraBody = modelName.includes('claude')? {
					extra_body: {
						thinking: {
							type: 'enabled',
							budget_tokens: claude_thinking_budget_tokens[reasoning_effort ?? 'medium'],
						},
					},
				}
			: {};

		if (format) {
			if (!schema || !schemaName) {
				throw new Error('Schema and schemaName are required when using a custom format');
			}
			const formatInstructions = generateTemplateForSchema(
				schema,
				format,
				formatOptions,
			);
			const lastMessage = messages[messages.length - 1];

			// Handle multi-modal content properly
			if (typeof lastMessage.content === 'string') {
				// Simple string content - append format instructions
				messages = [
					...messages.slice(0, -1),
					{
						role: lastMessage.role,
						content: `${lastMessage.content}\n\n${formatInstructions}`,
					},
				];
			} else if (Array.isArray(lastMessage.content)) {
				// Multi-modal content - append format instructions to the text part
				const updatedContent = lastMessage.content.map((item) => {
					if (item.type === 'text') {
						return {
							...item,
							text: `${item.text}\n\n${formatInstructions}`,
						};
					}
					return item;
				});
				messages = [
					...messages.slice(0, -1),
					{
						role: lastMessage.role,
						content: updatedContent,
					},
				];
			}
		}
        // messages.forEach((message) => {
        //     console.log("===============================================================================================================================================")
        //     console.log("Role: ", message.role, "Content: ", message.content);
        //     console.log("===============================================================================================================================================")
        // });

		console.log(`Running inference with ${modelName} using structured output with ${format} format, reasoning effort: ${reasoning_effort}, max tokens: ${maxTokens}, temperature: ${temperature}`);
		// Optimize messages to reduce token count
		const optimizedMessages = optimizeInputs(messages);
		console.log(`Token optimization: Original messages size ~${JSON.stringify(messages).length} chars, optimized size ~${JSON.stringify(optimizedMessages).length} chars`);

		const toolsOpts = tools ? { tools, tool_choice: 'auto' as const } : {};
		// Call OpenAI API with proper structured output format
		const response = await client.chat.completions.create({
			...schemaObj,
			...extraBody,
            ...toolsOpts,
			model: modelName,
			messages: optimizedMessages as OpenAI.ChatCompletionMessageParam[],
			max_completion_tokens: maxTokens || 150000,
			stream: stream ? true : false,
			reasoning_effort,
			temperature,
		}, {
            headers: {
                "cf-aig-metadata": JSON.stringify({
                    chatId: id,
                    schemaName,
                })
            }
        });
		let toolCalls: ChatCompletionMessageFunctionToolCall[] = [];

		let content = '';
		if (stream) {
			// If streaming is enabled, handle the stream response
			if (response instanceof Stream) {
				let streamIndex = 0;
				for await (const event of response) {
					const delta = event.choices[0]?.delta;
					if (delta?.tool_calls) {
						// Accumulate tool calls
						try {
							for (let i = 0; i < delta.tool_calls.length; i++) {
								const deltaToolCall = delta.tool_calls[i];
								if (!toolCalls[i]) {
									toolCalls[i] = {
										id: deltaToolCall.id || `tool_${Date.now()}_${i}`,
										type: 'function',
										function: {
											name: deltaToolCall.function?.name || '',
											arguments: deltaToolCall.function?.arguments || '',
										},
									};
								} else {
									// Append to existing tool call
									if (deltaToolCall.function?.name && !toolCalls[i].function.name) {
										toolCalls[i].function.name = deltaToolCall.function.name;
									}
									if (deltaToolCall.function?.arguments) {
										toolCalls[i].function.arguments += deltaToolCall.function.arguments;
									}
								}
							}
						} catch (error) {
							console.error('Error processing tool calls:', error);
						}
					}
					content += delta?.content || '';
					const slice = content.slice(streamIndex);
					if (slice.length >= stream.chunk_size || event.choices[0]?.finish_reason !== null) {
						stream.onChunk(slice);
						streamIndex += slice.length;
					}
				}
			} else {
				// Handle the case where stream was requested but a non-stream response was received
				console.error('Expected a stream response but received a ChatCompletion object.');
				// Attempt to extract content from the non-stream response
				content = (response as OpenAI.ChatCompletion).choices[0]?.message?.content || '';
			}
		} else {
			// If not streaming, get the full response content (response is ChatCompletion)
			content = (response as OpenAI.ChatCompletion).choices[0]?.message?.content || '';
            toolCalls = (response as OpenAI.ChatCompletion).choices[0]?.message?.tool_calls as ChatCompletionMessageFunctionToolCall[] || [];
			// Also print the total number of tokens used in the prompt
			const totalTokens = (response as OpenAI.ChatCompletion).usage?.total_tokens;
			console.log(`Total tokens used in prompt: ${totalTokens}`);
		}

		if (!content && !stream && !toolCalls.length) {
			// // Only error if not streaming and no content
			// console.error('No content received from OpenAI', JSON.stringify(response, null, 2));
			// throw new Error('No content received from OpenAI');
            console.warn('No content received from OpenAI', JSON.stringify(response, null, 2));
            return { string: "", toolCalls: [] };
		}

        const executedToolCalls = await executeToolCalls(toolCalls);

        if (executedToolCalls.length) {
            console.log(`Tool calls executed:`, JSON.stringify(executedToolCalls, null, 2));
            // Generate a new response with the tool calls executed
            const newMessages = [
                ...messages, 
                { role: "assistant" as MessageRole, content: null, tool_calls: toolCalls },
                ...executedToolCalls.map((result, _) => ({
                    role: "tool" as MessageRole,
                    content: JSON.stringify(result.result),
                }))
            ];
            
            if (schema && schemaName) {
                return await infer<OutputSchema>({
                    env,
                    id,
                    messages: newMessages,
                    schema,
                    schemaName,
                    format,
                    formatOptions,
                    modelName,
                    maxTokens,
                    stream,
                    tools,
                    reasoning_effort,
                    temperature,
                });
            } else {
                return infer({
                    env,
                    id,
                    messages: newMessages,
                    modelName,
                    maxTokens,
                    stream,
                    tools,
                    reasoning_effort,
                    temperature,
                });
            }
        }

		if (!schema) {
			return { string: content, toolCalls: executedToolCalls };
		}

		try {
			// Parse the response
			const parsedContent = format
				? parseContentForSchema(content, format, schema, formatOptions)
				: JSON.parse(content);

			// Use Zod's safeParse for proper error handling
			const result = schema.safeParse(parsedContent);

			if (!result.success) {
				console.log('Raw content:', content);
				console.log('Parsed data:', parsedContent);
				console.error('Schema validation errors:', result.error.format());
				throw new Error(`Failed to validate AI response against schema: ${result.error.message}`);
			}

			return { object: result.data, toolCalls: executedToolCalls };
		} catch (parseError) {
			console.error('Error parsing response:', parseError);
			throw new InferError('Failed to parse response', content);
		}
	} catch (error) {
		console.error('Error in inferWithSchemaOutput:', error);
		throw error;
	}
}
