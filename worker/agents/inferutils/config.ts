import { AgentConfig, AIModels } from "./config.types";


export const AGENT_CONFIG: AgentConfig = {
    templateSelection: {
        name: AIModels.GEMINI_2_5_FLASH_LITE,
        providerOverride: 'direct',
        // reasoning_effort: 'medium',
        max_tokens: 2000,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    // blueprint: {
    //     name: AIModels.GEMINI_2_5_PRO,
    //     // name: AIModels.OPENAI_O4_MINI,
    //     // reasoning_effort: 'low',
    //     reasoning_effort: 'medium',
    //     max_tokens: 64000,
    //     fallbackModel: AIModels.OPENAI_O3,
    //     temperature: 0.7,
    // },
    blueprint: {
        name: AIModels.OPENAI_5_MINI,
        // providerOverride: 'direct',
        // name: AIModels.OPENAI_O4_MINI,
        // reasoning_effort: 'low',
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
        // max_tokens: 64000,
        // name: 'chatgpt-4o-latest',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    // phaseGeneration: {
    //     name: AIModels.OPENAI_5_MINI,
    //     providerOverride: 'direct',
    //     // name: AIModels.OPENAI_O4_MINI,
    //     // reasoning_effort: 'low',
    //     reasoning_effort: 'medium',
    //     max_tokens: 16000,
    //     fallbackModel: AIModels.OPENAI_O3,
    //     temperature: 0.7,
    // },
    // phaseGeneration: {
    //     // name: AIModels.GEMINI_2_5_FLASH_PREVIEW,
    //     name: AIModels.CEREBRAS_QWEN_3_CODER,
    //     // name: AIModels.CLAUDE_4_SONNET,
    //     reasoning_effort: undefined,
    //     // max_tokens: 6000,
    //     max_tokens: 64000,
    //     temperature: 0.7,
    //     fallbackModel: AIModels.GEMINI_2_5_PRO,
    // },
    firstPhaseImplementation: {
        name: AIModels.GEMINI_2_5_PRO,
        // name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'low',
        // max_tokens: 6000,
        max_tokens: 64000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    phaseImplementation: {
        name: AIModels.GEMINI_2_5_PRO,
        // name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'low',
        // max_tokens: 6000,
        max_tokens: 64000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    realtimeCodeFixer: {
        name: AIModels.OPENAI_5_MINI,
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.CLAUDE_4_SONNET,
    },
    // realtimeCodeFixer: {
    //     name: AIModels.CEREBRAS_QWEN_3_CODER,
    //     reasoning_effort: undefined,
    //     max_tokens: 10000,
    //     temperature: 0.0,
    //     fallbackModel: AIModels.GEMINI_2_5_PRO,
    // },
    // realtimeCodeFixer: {
    //     name: AIModels.KIMI_2_5,
    //     providerOverride: 'direct',
    //     reasoning_effort: 'medium',
    //     max_tokens: 32000,
    //     temperature: 0.7,
    //     fallbackModel: AIModels.OPENAI_OSS,
    // },
    fastCodeFixer: {
        name: AIModels.CEREBRAS_QWEN_3_CODER,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.0,
        fallbackModel: AIModels.OPENROUTER_QWEN_3_CODER,
    },
    conversationalResponse: {
        name: AIModels.GEMINI_2_5_FLASH,
        reasoning_effort: 'low',
        max_tokens: 32000,
        // temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    userSuggestionProcessor: {
        name: AIModels.GEMINI_2_5_PRO,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 1,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    codeReview: {
        name: AIModels.OPENAI_5,
        // name: 'o4-mini',
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
    screenshotAnalysis: {
        name: AIModels.GEMINI_2_5_PRO,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 0.1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
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
