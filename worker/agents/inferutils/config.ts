import { AgentConfig, AIModels } from "./config.types";

/*
Use these configs instead for better performance, less bugs and costs:

    blueprint: {
        name: AIModels.OPENAI_5_MINI,
        reasoning_effort: 'medium',
        max_tokens: 16000,
        fallbackModel: AIModels.OPENAI_O3,
        temperature: 1,
    },
    projectSetup: {
        name: AIModels.OPENAI_5_MINI,
        reasoning_effort: 'medium',
        max_tokens: 10000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    phaseGeneration: {
        name: AIModels.OPENAI_5_MINI,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    codeReview: {
        name: AIModels.OPENAI_5,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    fileRegeneration: {
        name: AIModels.OPENAI_5_MINI,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.CLAUDE_4_SONNET,
    },
    realtimeCodeFixer: {
        name: AIModels.OPENAI_5_MINI,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.CLAUDE_4_SONNET,
    },

For real time code fixer, here are some alternatives: 
    realtimeCodeFixer: {
        name: AIModels.CEREBRAS_QWEN_3_CODER,
        reasoning_effort: undefined,
        max_tokens: 10000,
        temperature: 0.0,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },

OR
    realtimeCodeFixer: {
        name: AIModels.KIMI_2_5,
        providerOverride: 'direct',
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 0.7,
        fallbackModel: AIModels.OPENAI_OSS,
    },
*/


export const AGENT_CONFIG: AgentConfig = {
    templateSelection: {
        name: AIModels.CLAUDE_4_5_SONNET,
        max_tokens: 2000,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
        temperature: 0.6,
    },
    blueprint: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 64000,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
        temperature: 0.7,
    },
    projectSetup: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'low',
        max_tokens: 10000,
        temperature: 0.2,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    phaseGeneration: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 0.2,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    firstPhaseImplementation: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'low',
        max_tokens: 64000,
        temperature: 0.2,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    phaseImplementation: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'low',
        max_tokens: 64000,
        temperature: 0.2,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    realtimeCodeFixer: {
        name: AIModels.DISABLED,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    // Not used right now
    fastCodeFixer: {
        name: AIModels.DISABLED,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.0,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    conversationalResponse: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'low',
        max_tokens: 4000,
        temperature: 0,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    codeReview: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 0.1,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    fileRegeneration: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 0,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
    // Not used right now
    screenshotAnalysis: {
        name: AIModels.CLAUDE_4_5_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 0.1,
        fallbackModel: AIModels.CLAUDE_4_5_SONNET,
    },
};


// Model validation utilities
export const ALL_AI_MODELS: readonly AIModels[] = Object.values(AIModels);
export type AIModelType = AIModels;

// Create tuple type for Zod enum validation
export const AI_MODELS_TUPLE = Object.values(AIModels) as [AIModels, ...AIModels[]];

export function isValidAIModel(model: string): model is AIModels {
    return Object.values(AIModels).includes(model as AIModels);
}

export function getValidAIModelsArray(): readonly AIModels[] {
    return ALL_AI_MODELS;
}
