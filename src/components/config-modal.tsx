import { useState, useEffect } from 'react';
import { Settings, Play, RotateCcw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ModelConfig, AgentConfig } from './model-config-tabs';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentConfig: AgentConfig;
  userConfig?: ModelConfig;
  defaultConfig?: ModelConfig;
  onSave: (config: any) => Promise<void>;
  onTest: () => Promise<void>;
  onReset: () => Promise<void>;
  isTesting: boolean;
}

// Available models (same as in settings)
const getAvailableModels = () => [
  { value: 'default', label: 'Use default' },
  // OpenAI Models
  { value: 'openai/gpt-5', label: 'GPT-5 (OpenAI)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (OpenAI)' },
  { value: 'openai/o3', label: 'O3 (OpenAI)' },
  { value: 'openai/o4-mini', label: 'O4 Mini (OpenAI)' },
  { value: 'openai/chatgpt-4o-latest', label: 'ChatGPT-4o Latest (OpenAI)' },
  { value: 'openai/gpt-4.1-2025-04-14', label: 'GPT-4.1 (OpenAI)' },
  { value: 'openai/gpt-oss-120b', label: 'GPT-OSS-120B (OpenAI)' },
  // Anthropic Models
  { value: 'anthropic/claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet Latest (Anthropic)' },
  { value: 'anthropic/claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet (Anthropic)' },
  { value: 'anthropic/claude-opus-4-20250514', label: 'Claude 4 Opus (Anthropic)' },
  { value: 'anthropic/claude-sonnet-4-20250514', label: 'Claude 4 Sonnet (Anthropic)' },
  // Google Models
  { value: 'google-ai-studio/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Google)' },
  { value: 'google-ai-studio/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Google)' },
  { value: '[gemini]gemini-2.5-flash-lite-preview-06-17', label: 'Gemini 2.5 Flash Lite (Google)' },
  { value: 'google-ai-studio/gemini-2.0-flash', label: 'Gemini 2.0 Flash (Google)' },
  { value: 'google-ai-studio/gemini-1.5-flash-8b-latest', label: 'Gemini 1.5 Flash 8B (Google)' },
  // OpenRouter Models
  { value: '[openrouter]qwen/qwen3-coder', label: 'Qwen 3 Coder (OpenRouter)' },
  { value: '[openrouter]moonshotai/kimi-k2', label: 'Kimi K2 (OpenRouter)' },
  // Cerebras Models
  { value: 'cerebras/gpt-oss-120b', label: 'GPT-OSS-120B (Cerebras)' },
  { value: 'cerebras/qwen-3-coder-480b', label: 'Qwen 3 Coder 480B (Cerebras)' }
];

// Reasoning effort options
const getReasoningEffortOptions = () => [
  { value: 'default', label: 'Use default' },
  { value: 'low', label: 'Low (Fast)' },
  { value: 'medium', label: 'Medium (Balanced)' },
  { value: 'high', label: 'High (Deep)' }
];

// Helper to get model display name
const getModelDisplayName = (modelValue: string) => {
  const model = getAvailableModels().find(m => m.value === modelValue);
  return model ? model.label : modelValue;
};

// Helper to get model recommendations
const getModelRecommendation = (agentAction: string) => {
  const recommendations: Record<string, string> = {
    templateSelection: '💡 Recommended: Fast models like Flash Lite or GPT-5 Mini for quick responses',
    blueprint: '🏗️ Recommended: Creative models like GPT-5 or Claude 4 Sonnet for design thinking',
    projectSetup: '⚙️ Recommended: Reliable instruction-following models like GPT-5 Mini or Claude Sonnet',
    phaseGeneration: '📋 Recommended: Models with large context like GPT-5 or Gemini 2.5 Pro for planning',
    firstPhaseImplementation: '🏁 Recommended: High-capability coding models like Gemini 2.5 Pro or Claude 4 Sonnet',
    phaseImplementation: '⚡ Recommended: Strong coding models like Gemini 2.5 Pro or Claude 4 Sonnet',
    realtimeCodeFixer: '🚀 Recommended: Fast debugging models like Claude 4 Sonnet or Cerebras models',
    fastCodeFixer: '⚡ Recommended: Ultra-fast models like Cerebras Qwen or GPT-OSS for speed',
    conversationalResponse: '💬 Recommended: Balanced models like Gemini 2.5 Flash or Claude 3.5 Sonnet',
    userSuggestionProcessor: '🎯 Recommended: Understanding models like Gemini 2.5 Pro or GPT-5',
    codeReview: '🔍 Recommended: Analytical models like Gemini 2.5 Pro with large context windows',
    fileRegeneration: '📝 Recommended: Pure coding models like Claude 4 Sonnet or Cerebras Qwen',
    screenshotAnalysis: '👁️ Recommended: Vision-capable models like Gemini 2.5 Pro for image analysis'
  };
  return recommendations[agentAction] || '';
};

// Helper to get parameter guidance
const getParameterGuidance = (param: string, agentAction: string) => {
  const guidance: Record<string, Record<string, string>> = {
    temperature: {
      templateSelection: 'Low (0.1-0.3) for consistent template matching',
      blueprint: 'Medium-High (0.7-1.0) for creative design ideas',
      projectSetup: 'Low (0.1-0.3) for reliable, precise setup',
      phaseGeneration: 'Medium (0.5-0.7) for structured planning',
      phaseImplementation: 'Low-Medium (0.2-0.5) for accurate code',
      realtimeCodeFixer: 'Low-Medium (0.3-0.5) for focused debugging',
      fastCodeFixer: 'Very Low (0.0-0.2) for precise quick fixes',
      codeReview: 'Low-Medium (0.2-0.4) for objective analysis'
    },
    maxTokens: {
      templateSelection: 'Low (1K-2K) - Simple template selection',
      blueprint: 'High (16K-64K) - Detailed architecture planning',
      projectSetup: 'Medium (4K-10K) - Setup instructions and structure',
      phaseGeneration: 'High (32K-64K) - Comprehensive project breakdown',
      phaseImplementation: 'Very High (64K+) - Large code implementations',
      realtimeCodeFixer: 'Medium (8K-32K) - Code analysis and fixes',
      fastCodeFixer: 'Medium (8K-32K) - Quick focused fixes',
      codeReview: 'High (32K-64K) - Thorough code analysis'
    },
    reasoningEffort: {
      templateSelection: 'Low recommended - Speed is priority over deep thinking',
      blueprint: 'Medium-High recommended - Creative thinking required for design',
      projectSetup: 'Low recommended - Following instructions precisely',
      phaseGeneration: 'Medium-High recommended - Strategic planning needs analysis',
      phaseImplementation: 'Low recommended - Focus on execution over reasoning',
      realtimeCodeFixer: 'Medium recommended - Balance speed with debugging analysis',
      fastCodeFixer: 'Low recommended - Prioritize speed over deep analysis',
      codeReview: 'High recommended - Thorough analysis of code quality'
    }
  };
  return guidance[param]?.[agentAction] || '';
};

export function ConfigModal({
  isOpen,
  onClose,
  agentConfig,
  userConfig,
  defaultConfig,
  onSave,
  onTest,
  onReset,
  isTesting
}: ConfigModalProps) {
  const [formData, setFormData] = useState({
    modelName: userConfig?.name || 'default',
    maxTokens: userConfig?.max_tokens?.toString() || '',
    temperature: userConfig?.temperature?.toString() || '',
    reasoningEffort: userConfig?.reasoning_effort || 'default',
    fallbackModel: userConfig?.fallbackModel || 'default'
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form when modal opens/closes or config changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        modelName: userConfig?.name || 'default',
        maxTokens: userConfig?.max_tokens?.toString() || '',
        temperature: userConfig?.temperature?.toString() || '',
        reasoningEffort: userConfig?.reasoning_effort || 'default',
        fallbackModel: userConfig?.fallbackModel || 'default'
      });
      setHasChanges(false);
    }
  }, [isOpen, userConfig]);

  // Check for changes
  useEffect(() => {
    const originalFormData = {
      modelName: userConfig?.name || 'default',
      maxTokens: userConfig?.max_tokens?.toString() || '',
      temperature: userConfig?.temperature?.toString() || '',
      reasoningEffort: userConfig?.reasoning_effort || 'default',
      fallbackModel: userConfig?.fallbackModel || 'default'
    };
    
    setHasChanges(JSON.stringify(formData) !== JSON.stringify(originalFormData));
  }, [formData, userConfig]);

  const handleSave = async () => {
    const config = {
      modelName: formData.modelName === 'default' ? null : formData.modelName,
      maxTokens: formData.maxTokens ? parseInt(formData.maxTokens) : null,
      temperature: formData.temperature ? parseFloat(formData.temperature) : null,
      reasoningEffort: formData.reasoningEffort === 'default' ? null : formData.reasoningEffort,
      fallbackModel: formData.fallbackModel === 'default' ? null : formData.fallbackModel
    };
    
    await onSave(config);
  };

  const handleReset = async () => {
    await onReset();
    onClose();
  };

  const isUserOverride = userConfig?.isUserOverride || false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="overflow-y-auto" style={{ maxWidth: '48rem', width: '95vw' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure {agentConfig.name}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>{agentConfig.description}</p>
            {getModelRecommendation(agentConfig.key) && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {getModelRecommendation(agentConfig.key)}
                </AlertDescription>
              </Alert>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium text-sm">Configuration Status</p>
              <p className="text-xs text-muted-foreground">
                {isUserOverride ? 'Using custom configuration' : 'Using system defaults'}
              </p>
            </div>
            <Badge variant={isUserOverride ? "default" : "outline"}>
              {isUserOverride ? "Custom" : "Default"}
            </Badge>
          </div>

          {/* Core Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Model Selection</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">AI Model</Label>
                <Select value={formData.modelName} onValueChange={(value) => setFormData({...formData, modelName: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableModels().map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {defaultConfig?.name && (
                  <p className="text-xs text-muted-foreground">
                    🔧 System default: {getModelDisplayName(defaultConfig.name)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Fallback Model</Label>
                <Select value={formData.fallbackModel} onValueChange={(value) => setFormData({...formData, fallbackModel: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fallback model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableModels().map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {defaultConfig?.fallbackModel && (
                  <p className="text-xs text-muted-foreground">
                    🔧 System default: {getModelDisplayName(defaultConfig.fallbackModel)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Parameters */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Parameters</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Temperature</Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  placeholder={defaultConfig?.temperature ? `${defaultConfig.temperature}` : '0.7'}
                  onChange={(e) => setFormData({...formData, temperature: e.target.value})}
                />
                <div className="space-y-1">
                  {defaultConfig?.temperature && (
                    <p className="text-xs text-muted-foreground">
                      🔧 System default: {defaultConfig.temperature}
                    </p>
                  )}
                  {getParameterGuidance('temperature', agentConfig.key) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      💡 {getParameterGuidance('temperature', agentConfig.key)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Max Tokens</Label>
                <Input
                  type="number"
                  min="1"
                  max="200000"
                  value={formData.maxTokens}
                  placeholder={defaultConfig?.max_tokens ? `${defaultConfig.max_tokens}` : '4000'}
                  onChange={(e) => setFormData({...formData, maxTokens: e.target.value})}
                />
                <div className="space-y-1">
                  {defaultConfig?.max_tokens && (
                    <p className="text-xs text-muted-foreground">
                      🔧 System default: {defaultConfig.max_tokens?.toLocaleString()}
                    </p>
                  )}
                  {getParameterGuidance('maxTokens', agentConfig.key) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      💡 {getParameterGuidance('maxTokens', agentConfig.key)}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Reasoning Effort</Label>
                <Select value={formData.reasoningEffort} onValueChange={(value) => setFormData({...formData, reasoningEffort: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reasoning effort..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getReasoningEffortOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-1">
                  {defaultConfig?.reasoning_effort && (
                    <p className="text-xs text-muted-foreground">
                      🔧 System default: {defaultConfig.reasoning_effort}
                    </p>
                  )}
                  {getParameterGuidance('reasoningEffort', agentConfig.key) && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      💡 {getParameterGuidance('reasoningEffort', agentConfig.key)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto font-medium text-sm gap-2">
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Advanced Settings
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Additional configuration options like provider overrides and custom headers would be available here in a full implementation.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter className="gap-3 flex-col sm:flex-row sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={isTesting}
              className="gap-2"
            >
              {isTesting ? (
                <>
                  <Settings className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Test Config
                </>
              )}
            </Button>
            
            {isUserOverride && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="gap-2 text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to Default
              </Button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}