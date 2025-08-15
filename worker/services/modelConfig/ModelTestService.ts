/**
 * Model Test Service
 * Handles testing of model configurations with user API keys
 */

import { OpenAI } from 'openai';
import { ModelConfig } from '../../agents/inferutils/config';
import { getConfigurationForModel } from '../../agents/inferutils/core';

export interface TestResult {
    success: boolean;
    error?: string;
    model?: string;
    latencyMs?: number;
}

export interface ModelTestRequest {
    modelConfig: ModelConfig;
    userApiKeys?: Map<string, string>;
    testPrompt?: string;
}

export interface ModelTestResult {
    success: boolean;
    error?: string;
    responsePreview?: string;
    latencyMs: number;
    modelUsed: string;
    tokensUsed?: {
        prompt: number;
        completion: number;
        total: number;
    };
}

export class ModelTestService {
    constructor(private env: Env) {}

    /**
     * Test a model configuration by making a simple chat request
     */
    async testModelConfig({
        modelConfig,
        userApiKeys,
        testPrompt = "Hello! Please respond with 'Test successful' to confirm the connection is working."
    }: ModelTestRequest): Promise<ModelTestResult> {
        const startTime = Date.now();
        let client: OpenAI;
        const modelName: string = modelConfig.name;
        let cleanModelName = modelName;

        try {
            // Get configuration for the model with user API keys properly integrated
            const config = await getConfigurationForModel(modelName, this.env, userApiKeys);

            // Create OpenAI client using the properly configured settings
            client = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseURL,
                defaultHeaders: config.defaultHeaders
            });

            // Remove provider prefix from model name for API call
            cleanModelName = modelName.replace(/\[.*?\]/, '');

            // Make a simple chat completion request
            const response = await client.chat.completions.create({
                model: cleanModelName,
                messages: [
                    {
                        role: 'user',
                        content: testPrompt
                    }
                ],
                max_tokens: Math.min(modelConfig.max_tokens || 100, 100), // Limit to 100 tokens for test
                temperature: modelConfig.temperature || 0.1,
                ...(modelConfig.reasoning_effort && {
                    reasoning_effort: modelConfig.reasoning_effort
                })
            });

            const endTime = Date.now();
            const latencyMs = endTime - startTime;

            const content = response.choices[0]?.message?.content || '';
            
            return {
                success: true,
                responsePreview: content.length > 100 ? content.substring(0, 100) + '...' : content,
                latencyMs,
                modelUsed: cleanModelName,
                tokensUsed: {
                    prompt: response.usage?.prompt_tokens || 0,
                    completion: response.usage?.completion_tokens || 0,
                    total: response.usage?.total_tokens || 0
                }
            };

        } catch (error: any) {
            const endTime = Date.now();
            const latencyMs = endTime - startTime;

            // Return raw error from OpenAI SDK as requested by user
            let rawError = 'Unknown error occurred';
            
            if (error instanceof Error) {
                rawError = error.message;
            } else if (error?.error?.message) {
                rawError = error.error.message;
            } else if (error?.message) {
                rawError = error.message;
            } else {
                // If it's an object, stringify it to show the raw structure
                rawError = JSON.stringify(error);
            }

            return {
                success: false,
                error: rawError, // Raw error from OpenAI SDK
                latencyMs,
                modelUsed: cleanModelName
            };
        }
    }

    /**
     * Test a specific provider's API key
     */
    async testProviderKey(provider: string, apiKey: string): Promise<TestResult> {
        const startTime = Date.now();

        try {
            // Get a simple model for this provider to test with
            const testModel = this.getTestModelForProvider(provider);
            if (!testModel) {
                return {
                    success: false,
                    error: `No test model available for provider: ${provider}`
                };
            }

            // Create a userApiKeys map with the test key
            const testApiKeys = new Map<string, string>();
            testApiKeys.set(provider, apiKey);
            
            const config = await getConfigurationForModel(testModel, this.env, testApiKeys);
            
            // Create client using properly configured settings
            const client = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseURL,
                defaultHeaders: config.defaultHeaders
            });

            // Remove provider prefix
            const cleanModelName = testModel.replace(/\[.*?\]/, '');

            // Simple test request
            const response = await client.chat.completions.create({
                model: cleanModelName,
                messages: [
                    {
                        role: 'user',
                        content: 'Test connection. Please respond with "OK".'
                    }
                ],
                max_tokens: 10,
                temperature: 0
            });

            const endTime = Date.now();

            if (response.choices[0]?.message?.content) {
                return {
                    success: true,
                    model: cleanModelName,
                    latencyMs: endTime - startTime
                };
            } else {
                return {
                    success: false,
                    error: 'No response received from model'
                };
            }

        } catch (error: any) {
            // Return raw error from OpenAI SDK as requested by user
            let rawError = 'Connection test failed';
            
            if (error instanceof Error) {
                rawError = error.message;
            } else if (error?.error?.message) {
                rawError = error.error.message;
            } else if (error?.message) {
                rawError = error.message;
            } else {
                // If it's an object, stringify it to show the raw structure
                rawError = JSON.stringify(error);
            }

            return {
                success: false,
                error: rawError // Raw error from OpenAI SDK
            };
        }
    }


    /**
     * Get a simple test model for a given provider
     */
    private getTestModelForProvider(provider: string): string | null {
        const testModels: Record<string, string> = {
            'openai': 'openai/gpt-4o-mini',
            'anthropic': 'anthropic/claude-3-haiku-20240307',
            'google-ai-studio': 'google-ai-studio/gemini-1.5-flash',
            'gemini': '[gemini]gemini-1.5-flash',
            'openrouter': '[openrouter]openai/gpt-4o-mini',
            'cerebras': 'cerebras/llama3.1-8b'
        };

        return testModels[provider] || null;
    }
}