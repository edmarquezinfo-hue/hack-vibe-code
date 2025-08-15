/**
 * Model Test Service
 * Handles testing of model configurations with user API keys
 */

import { ModelConfig } from '../../agents/inferutils/config';
import { infer, InferError } from '../../agents/inferutils/core';
import { createUserMessage } from '../../agents/inferutils/common';

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
     * Test a model configuration by making a simple chat request using core inference
     */
    async testModelConfig({
        modelConfig,
        userApiKeys,
        testPrompt = "Hello! Please respond with 'Test successful' to confirm the connection is working."
    }: ModelTestRequest): Promise<ModelTestResult> {
        const startTime = Date.now();
        const modelName: string = modelConfig.name;
        const cleanModelName = modelName.replace(/\[.*?\]/, ''); // Remove provider prefix for display

        try {
            // Create test message using core abstractions
            const testMessage = createUserMessage(testPrompt);

            // Use core inference system to test the model configuration
            const response = await infer({
                env: this.env,
                id: `test-${Date.now()}`, // Generate unique test ID
                messages: [testMessage],
                modelName: modelName,
                maxTokens: Math.min(modelConfig.max_tokens || 100, 100), // Limit to 100 tokens for test
                temperature: modelConfig.temperature || 0.1,
                reasoning_effort: modelConfig.reasoning_effort,
                userApiKeys: userApiKeys
            });

            const endTime = Date.now();
            const latencyMs = endTime - startTime;

            const content = response.string || '';
            
            return {
                success: true,
                responsePreview: content.length > 100 ? content.substring(0, 100) + '...' : content,
                latencyMs,
                modelUsed: cleanModelName,
                tokensUsed: {
                    prompt: 0, // Core inference doesn't expose token counts in the response
                    completion: 0, // Would need to be added to core system if needed
                    total: 0
                }
            };

        } catch (error: unknown) {
            const endTime = Date.now();
            const latencyMs = endTime - startTime;

            // Handle InferError and other errors from core system
            let rawError = 'Unknown error occurred';
            
            if (error instanceof InferError) {
                rawError = error.message;
            } else if (error instanceof Error) {
                rawError = error.message;
            } else if (typeof error === 'object' && error !== null) {
                // Handle error objects from the core system
                const errorObj = error as any;
                if (errorObj.message) {
                    rawError = errorObj.message;
                } else if (errorObj.error?.message) {
                    rawError = errorObj.error.message;
                } else {
                    rawError = JSON.stringify(error);
                }
            } else {
                rawError = String(error);
            }

            return {
                success: false,
                error: rawError,
                latencyMs,
                modelUsed: cleanModelName
            };
        }
    }

    /**
     * Test a specific provider's API key using core inference
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
            
            // Create test message using core abstractions
            const testMessage = createUserMessage('Test connection. Please respond with "OK".');

            // Use core inference system to test the provider key
            const response = await infer({
                env: this.env,
                id: `provider-test-${Date.now()}`, // Generate unique test ID
                messages: [testMessage],
                modelName: testModel,
                maxTokens: 10,
                temperature: 0,
                userApiKeys: testApiKeys
            });

            const endTime = Date.now();
            const cleanModelName = testModel.replace(/\[.*?\]/, '');

            if (response.string && response.string.trim()) {
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

        } catch (error: unknown) {
            const endTime = Date.now();
            const latencyMs = endTime - startTime;

            // Handle InferError and other errors from core system
            let rawError = 'Connection test failed';
            
            if (error instanceof InferError) {
                rawError = error.message;
            } else if (error instanceof Error) {
                rawError = error.message;
            } else if (typeof error === 'object' && error !== null) {
                // Handle error objects from the core system
                const errorObj = error as any;
                if (errorObj.message) {
                    rawError = errorObj.message;
                } else if (errorObj.error?.message) {
                    rawError = errorObj.error.message;
                } else {
                    rawError = JSON.stringify(error);
                }
            } else {
                rawError = String(error);
            }

            return {
                success: false,
                error: rawError,
                latencyMs
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