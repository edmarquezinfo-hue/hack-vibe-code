import { ReasoningEffort } from "openai/resources.mjs";

export enum AIModels {
	GEMINI_2_5_PRO = 'google-ai-studio/gemini-2.5-pro',
	GEMINI_2_5_FLASH = 'google-ai-studio/gemini-2.5-flash',
	GEMINI_2_5_FLASH_PREVIEW = 'google-ai-studio/gemini-2.5-flash-preview-05-20',
	GEMINI_2_5_FLASH_LITE = '[gemini]gemini-2.5-flash-lite-preview-06-17',
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
	OPENAI_O3 = 'openai/o3',
	OPENAI_O4_MINI = 'openai/o4-mini',
	OPENAI_CHATGPT_4O_LATEST = 'openai/chatgpt-4o-latest',
	OPENAI_4_1 = 'openai/gpt-4.1-2025-04-14',
    OPENAI_5 = 'openai/gpt-5',
    OPENAI_5_MINI = 'openai/gpt-5-mini',
    OPENAI_OSS = 'openai/gpt-oss-120b',

    OPENROUTER_QWEN_3_CODER = '[openrouter]qwen/qwen3-coder',
    OPENROUTER_KIMI_2_5 = '[openrouter]moonshotai/kimi-k2',

    // Cerebras models
    CEREBRAS_GPT_OSS = 'cerebras/gpt-oss-120b',
    CEREBRAS_QWEN_3_CODER = 'cerebras/qwen-3-coder-480b',
}

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
    firstPhaseImplementation: ModelConfig;
    codeReview: ModelConfig;
    fileRegeneration: ModelConfig;
    screenshotAnalysis: ModelConfig;
    realtimeCodeFixer: ModelConfig;
    fastCodeFixer: ModelConfig;
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
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: 'medium',
        max_tokens: 32000,
        temperature: 0.5,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
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
        name: AIModels.GEMINI_2_5_PRO,
        // name: 'o4-mini',
        reasoning_effort: 'low',
        max_tokens: 32000,
        temperature: 0.2,
        fallbackModel: AIModels.GEMINI_2_5_PRO,
    },
    fileRegeneration: {
        name: AIModels.CLAUDE_4_SONNET,
        reasoning_effort: undefined,
        max_tokens: 64000,
        temperature: 0.0,
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

export type AgentActionKey = keyof AgentConfig;
