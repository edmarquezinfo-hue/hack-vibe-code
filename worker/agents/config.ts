import { ReasoningEffort } from "openai/resources.mjs";
import { AIModels } from "./inferutils/aigateway";

export interface ModelConfig {
    name: AIModels;
    reasoning_effort?: ReasoningEffort;
    max_tokens?: number;
    temperature?: number;
    providerOverride?: 'cloudflare' | 'direct'
    fallbackModel?: AIModels;
}

export interface AgentConfig {
    templateSelection: ModelConfig;
    blueprint: ModelConfig;
    projectSetup: ModelConfig;
    phaseGeneration: ModelConfig;
    phaseImplementation: ModelConfig;
    codeReview: ModelConfig;
    fileRegeneration: ModelConfig;
    screenshotAnalysis: ModelConfig;
    realtimeCodeFixer: ModelConfig;
    conversationalResponse: ModelConfig;
    userSuggestionProcessor: ModelConfig;
}

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
        providerOverride: 'direct',
        // name: AIModels.OPENAI_O4_MINI,
        // reasoning_effort: 'low',
        reasoning_effort: 'medium',
        max_tokens: 16000,
        fallbackModel: AIModels.OPENAI_O3,
        temperature: 1,
    },
    projectSetup: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 10000,
        temperature: 0.7,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
    // phaseGeneration: {
    //     name: AIModels.CLAUDE_4_SONNET,
    //     reasoning_effort: 'medium',
    //     // max_tokens: 64000,
    //     // name: 'chatgpt-4o-latest',
    //     max_tokens: 32000,
    //     temperature: 0.8,
    //     fallbackModel: AIModels.GEMINI_2_5_FLASH,
    // },
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
    phaseGeneration: {
        // name: AIModels.GEMINI_2_5_FLASH_PREVIEW,
        name: AIModels.CEREBRAS_QWEN_3_CODER,
        // name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: undefined,
        // max_tokens: 6000,
        max_tokens: 64000,
        temperature: 0.7,
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
    // phaseImplementation: {
    //     // name: AIModels.GEMINI_2_5_FLASH_PREVIEW,
    //     name: AIModels.CEREBRAS_QWEN_3_CODER,
    //     // name: AIModels.CLAUDE_4_SONNET,
    //     reasoning_effort: undefined,
    //     // max_tokens: 6000,
    //     max_tokens: 64000,
    //     temperature: 0.7,
    //     fallbackModel: AIModels.GEMINI_2_5_PRO,
    // },
    realtimeCodeFixer: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 0.7,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    // realtimeCodeFixer: {
    //     name: AIModels.GEMINI_2_5_PRO,
    //     reasoning_effort: 'low',
    //     max_tokens: 10000,
    //     temperature: 0.0,
    //     fallbackModel: AIModels.GEMINI_2_5_PRO,
    // },
    // realtimeCodeFixer: {
    //     name: AIModels.KIMI_2_5,
    //     providerOverride: 'direct',
    //     reasoning_effort: 'medium',
    //     max_tokens: 32000,
    //     temperature: 0.0,
    //     fallbackModel: AIModels.OPENAI_OSS,
    // },
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
        name: AIModels.GEMINI_2_5_PRO,
        // name: 'o4-mini',
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    fileRegeneration: {
        name: AIModels.CEREBRAS_QWEN_3_CODER,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.7,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    screenshotAnalysis: {
        name: AIModels.GEMINI_2_5_PRO,
        reasoning_effort: 'medium',
        max_tokens: 8000,
        temperature: 0.1,
        fallbackModel: AIModels.GEMINI_2_5_FLASH,
    },
};

export type AgentActionKey = keyof AgentConfig;
