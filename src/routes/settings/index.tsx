import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Key, 
  Plus,
  Eye,
  EyeOff,
  Smartphone,
  LogOut,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Link,
  Github,
  Settings,
  ExternalLink,
  Unlink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const { theme: currentTheme, setTheme: setThemeContext } = useTheme();
  const [profileData, setProfileData] = useState({
    displayName: user?.displayName || '',
    username: user?.username || '',
    bio: user?.bio || '',
    timezone: user?.timezone || 'UTC'
  });
  const [isSaving, setIsSaving] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [appDefaultVisibility, setAppDefaultVisibility] = useState('private');
  const [activeSection, setActiveSection] = useState('profile');
  
  // GitHub integration state
  const [githubIntegration, setGithubIntegration] = useState<{
    hasIntegration: boolean;
    githubUsername?: string;
    loading: boolean;
  }>({ hasIntegration: false, loading: true });

  // Active sessions state
  const [activeSessions, setActiveSessions] = useState<{
    sessions: Array<{
      id: string;
      userAgent: string;
      ipAddress: string;
      lastActivity: string;
      createdAt: string;
      isCurrent: boolean;
    }>;
    loading: boolean;
  }>({ sessions: [], loading: true });

  // API Keys state
  const [apiKeys, setApiKeys] = useState<{
    keys: Array<{
      id: string;
      name: string;
      keyPreview: string;
      createdAt: string;
      lastUsed?: string;
      isActive: boolean;
    }>;
    loading: boolean;
  }>({ keys: [], loading: true });

  // User Secrets state
  const [userSecrets, setUserSecrets] = useState<{
    secrets: Array<{
      id: string;
      name: string;
      provider: string;
      secretType: string;
      keyPreview: string;
      environment: string;
      description?: string;
      createdAt: string;
      lastUsed?: string;
    }>;
    loading: boolean;
  }>({ secrets: [], loading: true });

  // Model configurations state
  const [agentConfigs, setAgentConfigs] = useState<Array<{key: string, name: string, description: string}>>([]);
  const [modelConfigs, setModelConfigs] = useState<Record<string, any>>({});
  const [defaultConfigs, setDefaultConfigs] = useState<Record<string, any>>({});
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [savingConfigs, setSavingConfigs] = useState(false);
  const [testingConfig, setTestingConfig] = useState<string | null>(null);
  
  // Templates state
  const [secretTemplates, setSecretTemplates] = useState<Array<{
    id: string;
    displayName: string;
    envVarName: string;
    provider: string;
    icon: string;
    description: string;
    instructions: string;
    placeholder: string;
    validation: string;
    required: boolean;
    category: string;
  }>>([]);
  
  const [secretDialog, setSecretDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isCustomSecret, setIsCustomSecret] = useState(false);
  const [newSecret, setNewSecret] = useState({
    templateId: '',
    name: '',
    envVarName: '',
    value: '',
    environment: 'production',
    description: ''
  });
  const [showSecretValue, setShowSecretValue] = useState(false);
  const [isSavingSecret, setIsSavingSecret] = useState(false);

  // Helper function to format camelCase to human readable
  const formatAgentConfigName = React.useCallback((key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }, []);

  // Load model configurations
  const loadModelConfigs = async () => {
    try {
      setLoadingConfigs(true);
      const response = await fetch('/api/model-configs', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setModelConfigs(data.data.configs || {});
          setDefaultConfigs(data.data.defaults || {});
        }
      }
    } catch (error) {
      console.error('Error loading model configurations:', error);
      toast.error('Failed to load model configurations');
    } finally {
      setLoadingConfigs(false);
    }
  };

  // Save model configuration
  const saveModelConfig = async (agentAction: string, config: any) => {
    try {
      const response = await fetch(`/api/model-configs/${agentAction}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        toast.success('Configuration saved successfully');
        await loadModelConfigs(); // Reload to get updated data
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving model configuration:', error);
      toast.error('Failed to save configuration');
    }
  };

  // Test model configuration
  const testModelConfig = async (agentAction: string) => {
    try {
      setTestingConfig(agentAction);
      const response = await fetch('/api/model-configs/test', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentActionName: agentAction,
          useUserKeys: true
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        const result = data.data.testResult;
        if (result.success) {
          toast.success(`Test successful! Model: ${result.modelUsed}, Response time: ${result.latencyMs}ms`);
        } else {
          toast.error(`Test failed: ${result.error}`);
        }
      } else {
        toast.error(data.error?.message || 'Test failed');
      }
    } catch (error) {
      console.error('Error testing configuration:', error);
      toast.error('Failed to test configuration');
    } finally {
      setTestingConfig(null);
    }
  };

  // Reset configuration to default
  const resetConfigToDefault = async (agentAction: string) => {
    try {
      const response = await fetch(`/api/model-configs/${agentAction}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        toast.success('Configuration reset to default');
        await loadModelConfigs();
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Failed to reset configuration');
      }
    } catch (error) {
      console.error('Error resetting configuration:', error);
      toast.error('Failed to reset configuration');
    }
  };

  // Reset all configurations
  const resetAllConfigs = async () => {
    try {
      setSavingConfigs(true);
      const response = await fetch('/api/model-configs/reset-all', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(`${data.data.resetCount} configurations reset to defaults`);
        await loadModelConfigs();
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Failed to reset configurations');
      }
    } catch (error) {
      console.error('Error resetting all configurations:', error);
      toast.error('Failed to reset all configurations');
    } finally {
      setSavingConfigs(false);
    }
  };

  // Get available models for select dropdown using actual AIModels enum values
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

  // Helper function to provide descriptions based on key patterns
  const getAgentConfigDescription = React.useCallback((key: string) => {
    const descriptions: Record<string, string> = {
      templateSelection: 'Quick template selection - Needs to be extremely fast with low latency. Intelligence level is less important than speed for rapid project bootstrapping.',
      blueprint: 'Project architecture & UI design - Requires strong design thinking, UI/UX understanding, and architectural planning skills. Speed is important but coding ability is not critical.',
      projectSetup: 'Technical scaffolding setup - Must excel at following technical instructions precisely and setting up proper project structure. Reliability and instruction-following are key.',
      phaseGeneration: 'Development phase planning - Needs rapid planning abilities with large context windows for understanding project scope. Quick thinking is essential, coding skills are not required.',
      firstPhaseImplementation: 'Initial development phase - Requires large context windows and excellent coding skills for implementing the foundation. Deep thinking is less critical than execution.',
      phaseImplementation: 'Subsequent development phases - Needs large context windows and superior coding abilities for complex feature implementation. Focus is on execution rather than reasoning.',
      realtimeCodeFixer: 'Real-time bug detection - Must be extremely fast at identifying and fixing code issues with strong debugging skills. Large context windows are not needed, speed is crucial.',
      fastCodeFixer: 'Ultra-fast code fixes - Optimized for maximum speed with decent coding ability. No deep thinking or large context required, pure speed and basic bug fixing.',
      conversationalResponse: 'User chat interactions - Handles natural conversation flow and user communication. Balanced capabilities for engaging dialogue and helpful responses.',
      userSuggestionProcessor: 'User feedback processing - Analyzes and implements user suggestions and feedback. Requires understanding user intent and translating to actionable changes.',
      codeReview: 'Code quality analysis - Needs large context windows, strong analytical thinking, and good speed for thorough code review. Must identify issues and suggest improvements.',
      fileRegeneration: 'File recreation - Focused on pure coding ability to regenerate or rewrite files. No context window or deep thinking required, just excellent code generation.',
      screenshotAnalysis: 'UI/design analysis - Analyzes visual designs and screenshots to understand UI requirements. Requires visual understanding and design interpretation skills.'
    };
    return descriptions[key] || `AI model configuration for ${formatAgentConfigName(key)}`;
  }, [formatAgentConfigName]);

  // Helper function to get reasoning effort options
  const getReasoningEffortOptions = () => [
    { value: 'default', label: 'Use default' },
    { value: 'low', label: 'Low (Fast)' },
    { value: 'medium', label: 'Medium (Balanced)' },
    { value: 'high', label: 'High (Deep)' }
  ];

  // Helper function to get parameter guidance
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

  // Helper function to get user-friendly model name
  const getModelDisplayName = (modelValue: string) => {
    const model = getAvailableModels().find(m => m.value === modelValue);
    return model ? model.label : modelValue;
  };

  // Helper function to get model recommendations based on agent action
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

  const handleSaveProfile = async () => {
    if (isSaving) return;
    
    try {
      setIsSaving(true);
      
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...profileData,
          theme: currentTheme
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('Profile settings saved');
        // Theme context is already updated by handleThemeChange
        // Refresh user data in auth context
        await refreshUser();
      } else {
        toast.error(data.error?.message || 'Failed to save profile settings');
      }
    } catch (error) {
      console.error('Profile save error:', error);
      toast.error('Failed to save profile settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    toast.error('Account deletion is not yet implemented');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Load GitHub integration status
  const loadGithubIntegration = async () => {
    try {
      const response = await fetch('/api/integrations/github/status', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setGithubIntegration({
          hasIntegration: data.data?.hasIntegration || false,
          githubUsername: data.data?.githubUsername,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading GitHub integration:', error);
      setGithubIntegration(prev => ({ ...prev, loading: false }));
    }
  };

  const handleConnectGithub = () => {
    window.location.href = '/api/integrations/github/connect';
  };

  const handleDisconnectGithub = async () => {
    try {
      const response = await fetch('/api/integrations/github', {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        setGithubIntegration({
          hasIntegration: false,
          githubUsername: undefined,
          loading: false
        });
        toast.success('GitHub account disconnected');
      } else {
        toast.error('Failed to disconnect GitHub account');
      }
    } catch (error) {
      console.error('Error disconnecting GitHub:', error);
      toast.error('Failed to disconnect GitHub account');
    }
  };

  // Load active sessions
  const loadActiveSessions = async () => {
    try {
      const response = await fetch('/api/auth/sessions', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveSessions({
          sessions: data.sessions || [{
            id: 'current',
            userAgent: navigator.userAgent,
            ipAddress: 'Current location',
            lastActivity: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            isCurrent: true
          }],
          loading: false
        });
      } else {
        setActiveSessions({
          sessions: [{
            id: 'current',
            userAgent: navigator.userAgent,
            ipAddress: 'Current location',
            lastActivity: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            isCurrent: true
          }],
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading active sessions:', error);
      setActiveSessions({
        sessions: [{
          id: 'current',
          userAgent: navigator.userAgent,
          ipAddress: 'Current location',
          lastActivity: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          isCurrent: true
        }],
        loading: false
      });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        toast.success('Session revoked successfully');
        loadActiveSessions();
      } else {
        toast.error('Failed to revoke session');
      }
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    }
  };

  // Load API keys
  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/auth/api-keys', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setApiKeys({
          keys: data.keys || [],
          loading: false
        });
      } else {
        setApiKeys({
          keys: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
      setApiKeys({
        keys: [],
        loading: false
      });
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const keyName = prompt('Enter a name for your API key:');
      if (!keyName) return;
      
      const response = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name: keyName })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('API key created successfully');
        alert(`Your API key: ${data.data.key}\n\nPlease save this key - you won't be able to see it again!`);
        loadApiKeys();
      } else {
        toast.error(data.error?.message || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Failed to create API key');
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      const response = await fetch(`/api/auth/api-keys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        toast.success('API key revoked successfully');
        loadApiKeys();
      } else {
        toast.error('Failed to revoke API key');
      }
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Failed to revoke API key');
    }
  };

  // Load user secrets
  const loadUserSecrets = async () => {
    try {
      const response = await fetch('/api/secrets', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserSecrets({
          secrets: data.data?.secrets || [],
          loading: false
        });
      } else {
        setUserSecrets({
          secrets: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('Error loading user secrets:', error);
      setUserSecrets({
        secrets: [],
        loading: false
      });
    }
  };

  // Load secret templates
  const loadSecretTemplates = async () => {
    try {
      const response = await fetch('/api/secrets/templates', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setSecretTemplates(data.data?.templates || []);
      }
    } catch (error) {
      console.error('Error loading secret templates:', error);
    }
  };

  const handleSaveSecret = async () => {
    if (isSavingSecret) return;
    
    try {
      setIsSavingSecret(true);
      
      const payload = isCustomSecret ? {
        name: newSecret.name,
        envVarName: newSecret.envVarName,
        value: newSecret.value,
        environment: newSecret.environment,
        description: newSecret.description
      } : {
        templateId: selectedTemplate,
        value: newSecret.value,
        environment: newSecret.environment
      };
      
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        toast.success('Secret saved successfully');
        resetSecretDialog();
        loadUserSecrets();
      } else {
        toast.error(data.error?.message || 'Failed to save secret');
      }
    } catch (error) {
      console.error('Error saving secret:', error);
      toast.error('Failed to save secret');
    } finally {
      setIsSavingSecret(false);
    }
  };

  const resetSecretDialog = () => {
    setSecretDialog(false);
    setSelectedTemplate(null);
    setIsCustomSecret(false);
    setNewSecret({
      templateId: '',
      name: '',
      envVarName: '',
      value: '',
      environment: 'production',
      description: ''
    });
    setShowSecretValue(false);
  };

  const handleDeleteSecret = async (secretId: string) => {
    try {
      const response = await fetch(`/api/secrets/${secretId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        toast.success('Secret deleted successfully');
        loadUserSecrets();
      } else {
        toast.error('Failed to delete secret');
      }
    } catch (error) {
      console.error('Error deleting secret:', error);
      toast.error('Failed to delete secret');
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'cloudflare': return '☁️';
      case 'stripe': return '💳';
      case 'openai': return '🤖';
      case 'anthropic': return '🧠';
      case 'github': return '🐙';
      case 'google': return '🔷';
      case 'vercel': return '▲';
      case 'supabase': return '🗄️';
      case 'custom': return '🔑';
      default: return '🔑';
    }
  };

  // Update form data when user changes
  React.useEffect(() => {
    if (user) {
      setProfileData({
        displayName: user.displayName || '',
        username: user.username || '',
        bio: user.bio || '',
        timezone: user.timezone || 'UTC'
      });
      // Don't override theme context with user.theme - theme context (localStorage) is the source of truth
      // Theme changes are handled by the theme context and persisted on profile save
    }
  }, [user]);


  // Load agent configurations dynamically from API
  React.useEffect(() => {
    fetch('/api/model-configs/defaults')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data.defaults) {
          const configs = Object.keys(data.data.defaults).map(key => ({
            key,
            name: formatAgentConfigName(key),
            description: getAgentConfigDescription(key)
          }));
          setAgentConfigs(configs);
        }
      })
      .catch(error => {
        console.error('Failed to load agent configurations:', error);
      });
  }, [getAgentConfigDescription]); // Include getAgentConfigDescription in dependency array

  // Load GitHub integration, sessions, API keys, user secrets, and model configs on component mount
  React.useEffect(() => {
    loadGithubIntegration();
    loadActiveSessions();
    loadApiKeys();
    loadUserSecrets();
    loadSecretTemplates();
    loadModelConfigs();

    // Check for integration status from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const integration = urlParams.get('integration');
    const status = urlParams.get('status');
    
    if (integration === 'github' && status) {
      if (status === 'success') {
        toast.success('GitHub account connected successfully!');
        // Reload integration status to reflect changes
        setTimeout(() => loadGithubIntegration(), 1000);
      } else if (status === 'error') {
        toast.error('Failed to connect GitHub account. Please try again.');
      }
      
      // Clean up URL params
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Scroll spy functionality
  React.useEffect(() => {
    const sections = ['profile', 'appearance', 'notifications', 'privacy', 'integrations', 'model-configs', 'secrets', 'security'];
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100; // Offset for better UX
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i]);
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(sections[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Call once to set initial state

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };


  return (
    <div className="min-h-screen bg-bg-light">
      {/* Side Navigation */}
      <nav className="fixed right-8 top-1/2 transform -translate-y-1/2 z-10 hidden xl:block">
        <div className="space-y-3">
          {[
            { id: 'profile', icon: User, label: 'Profile' },
            { id: 'appearance', icon: Palette, label: 'Appearance' },
            { id: 'notifications', icon: Bell, label: 'Notifications' },  
            { id: 'privacy', icon: Shield, label: 'Privacy' },
            { id: 'integrations', icon: Link, label: 'Integrations' },
            { id: 'model-configs', icon: Settings, label: 'Model Configs' },
            { id: 'secrets', icon: Key, label: 'API Keys' },
            { id: 'security', icon: Shield, label: 'Security' }
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className={`group relative flex items-center justify-center p-3 rounded-lg transition-all duration-200 ${
                activeSection === id 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
              title={label}
            >
              <Icon className={`h-5 w-5 transition-colors`} />
              <span className={`absolute right-full mr-3 px-2 py-1 bg-popover border rounded text-sm font-medium whitespace-nowrap shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                activeSection === id ? 'opacity-100' : ''
              }`}>
                {label}
              </span>
              {activeSection === id && (
                <div className="absolute right-full w-1 h-8 bg-primary rounded-l-full mr-1" />
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-2">
              Manage your account settings and preferences
            </p>
          </div>

          {/* Profile Section */}
          <Card id="profile">
            <CardHeader>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5" />
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Update your profile details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.avatarUrl} />
                  <AvatarFallback className="bg-gradient-to-br from-[#f48120] to-[#faae42] text-white text-2xl">
                    {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline">Change Avatar</Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 5MB.</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input 
                    id="displayName" 
                    value={profileData.displayName}
                    onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    placeholder="@username" 
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue={user?.email} disabled />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea 
                    id="bio" 
                    placeholder="Tell us about yourself..."
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={isSaving}
                  className="bg-gradient-to-r from-[#f48120] to-[#faae42] hover:from-[#faae42] hover:to-[#f48120] text-white"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card id="appearance">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Palette className="h-5 w-5" />
                <div>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Customize how the app looks</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label className="text-base">Theme</Label>
                  <RadioGroup value={currentTheme} onValueChange={(value) => {
                    const newTheme = value as 'light' | 'dark' | 'system';
                    setThemeContext(newTheme);
                  }} className="mt-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="light" id="light" />
                        <Label htmlFor="light" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            Light
                          </div>
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="dark" id="dark" />
                        <Label htmlFor="dark" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            Dark
                          </div>
                        </Label>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <RadioGroupItem value="system" id="system" />
                        <Label htmlFor="system" className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            System
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications Section */}
          <Card id="notifications">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5" />
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Manage notification preferences</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about your apps via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="push-notifications">Browser Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get real-time updates in your browser
                  </p>
                </div>
                <Switch
                  id="push-notifications"
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="marketing-emails">Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about new features and tips
                  </p>
                </div>
                <Switch
                  id="marketing-emails"
                  checked={marketingEmails}
                  onCheckedChange={setMarketingEmails}
                />
              </div>
            </CardContent>
          </Card>

          {/* Privacy Section */}
          <Card id="privacy">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                <div>
                  <CardTitle>Privacy</CardTitle>
                  <CardDescription>Control your privacy and data settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="profile-public">Public Profile</Label>
                  <p className="text-sm text-muted-foreground">
                    Make your profile visible to other users
                  </p>
                </div>
                <Switch
                  id="profile-public"
                  checked={profileVisibility === 'public'}
                  onCheckedChange={(checked) => setProfileVisibility(checked ? 'public' : 'private')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="app-discovery">App Discovery</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your public apps to appear in discovery
                  </p>
                </div>
                <Switch
                  id="app-discovery"
                  checked={appDefaultVisibility === 'public'}
                  onCheckedChange={(checked) => setAppDefaultVisibility(checked ? 'public' : 'private')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="analytics">Usage Analytics</Label>
                  <p className="text-sm text-muted-foreground">
                    Help improve the platform by sharing anonymous usage data
                  </p>
                </div>
                <Switch
                  id="analytics"
                  defaultChecked={true}
                />
              </div>
            </CardContent>
          </Card>

          {/* Integrations Section */}
          <Card id="integrations">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Link className="h-5 w-5" />
                <div>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>Connect external services and platforms</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {githubIntegration.loading ? (
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading GitHub integration status...</span>
                </div>
              ) : githubIntegration.hasIntegration ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#24292e] flex items-center justify-center">
                      <Github className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">GitHub Connected</p>
                      <p className="text-sm text-muted-foreground">
                        @{githubIntegration.githubUsername}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Connected
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDisconnectGithub}
                      className="gap-2"
                    >
                      <Unlink className="h-4 w-4" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Github className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">GitHub Repository Export</p>
                      <p className="text-sm text-muted-foreground">
                        {user?.provider === 'github' ? 'Repository integration should be automatic after GitHub login' : 'Connect to export apps to GitHub repositories'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleConnectGithub}
                    className="gap-2 bg-[#24292e] hover:bg-[#1a1e22] text-white"
                  >
                    <Github className="h-4 w-4" />
                    Connect GitHub
                  </Button>
                </div>
              )}
              
              <Separator />
              
              <div className="rounded-lg bg-muted/50 p-4">
                <div className="flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">GitHub Integration vs Login</p>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {user?.provider === 'github' && (
                        <div className="space-y-1">
                          <p className="text-green-600 font-medium">✓ You're signed in with GitHub OAuth</p>
                          <p className="text-amber-600 font-medium">ℹ️ If integration shows as disconnected, try logging out and back in</p>
                        </div>
                      )}
                      <p className="font-medium">Repository Integration allows you to:</p>
                      <ul className="space-y-1 ml-2">
                        <li>• Export generated apps directly to your GitHub repositories</li>
                        <li>• Automatically create repositories with proper file structure</li>
                        <li>• Set repository visibility (public/private)</li>
                        <li>• Continue development with full Git history</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Configuration Section */}
          <Card id="model-configs">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5" />
                <div>
                  <CardTitle>AI Model Configurations</CardTitle>
                  <CardDescription>Customize AI model settings and API keys for different operations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider API Keys Integration */}
              <div className="space-y-4">
                <h4 className="font-medium">Provider API Keys</h4>
                <p className="text-sm text-muted-foreground">
                  AI provider API keys are managed in the "API Keys & Secrets" section below. Configure your OpenAI, Anthropic, Google AI, and OpenRouter keys there.
                </p>
                
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-center gap-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Unified API Key Management</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        All AI provider keys are securely stored and managed in the API Keys & Secrets section below. They will automatically be used when you test configurations or run model inference.
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => scrollToSection('secrets')}
                      className="gap-2 shrink-0"
                    >
                      <Key className="h-4 w-4" />
                      Manage Keys
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Model Configuration Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">Model Configuration Overrides</h4>
                <p className="text-sm text-muted-foreground">
                  Customize model settings for different AI operations. Leave blank to use system defaults.
                </p>
                
                {loadingConfigs ? (
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading model configurations...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {agentConfigs.map((config) => {
                      const userConfig = modelConfigs[config.key];
                      const defaultConfig = defaultConfigs[config.key];
                      const isUserOverride = userConfig?.isUserOverride || false;
                      
                      return (
                        <div key={config.key} className="p-4 border rounded-lg bg-card">
                          <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1 flex-1 pr-3">
                              <h5 className="font-medium">{config.name}</h5>
                              <p className="text-xs text-muted-foreground leading-relaxed">{config.description}</p>
                              {getModelRecommendation(config.key) && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                  {getModelRecommendation(config.key)}
                                </p>
                              )}
                            </div>
                            <Badge variant={isUserOverride ? "default" : "outline"} className="text-xs shrink-0">
                              {isUserOverride ? "Custom" : "Default"}
                            </Badge>
                          </div>
                          
                          <div className="space-y-4">
                            {/* Model Selection Row */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">AI Model</Label>
                                <Select
                                  value={userConfig?.name || 'default'}
                                  onValueChange={(value) => {
                                    const updatedConfig = {
                                      modelName: value === 'default' ? null : value,
                                      maxTokens: userConfig?.max_tokens || null,
                                      temperature: userConfig?.temperature ?? null,
                                      reasoningEffort: userConfig?.reasoning_effort || null,
                                      fallbackModel: userConfig?.fallback_model || null
                                    };
                                    saveModelConfig(config.key, updatedConfig);
                                  }}
                                >
                                  <SelectTrigger className="h-9">
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
                                <Select
                                  value={userConfig?.fallback_model || 'default'}
                                  onValueChange={(value) => {
                                    const updatedConfig = {
                                      modelName: userConfig?.name || null,
                                      maxTokens: userConfig?.max_tokens || null,
                                      temperature: userConfig?.temperature ?? null,
                                      reasoningEffort: userConfig?.reasoning_effort || null,
                                      fallbackModel: value === 'default' ? null : value
                                    };
                                    saveModelConfig(config.key, updatedConfig);
                                  }}
                                >
                                  <SelectTrigger className="h-9">
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
                            
                            {/* Parameters Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Temperature</Label>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="2" 
                                  step="0.1" 
                                  value={userConfig?.temperature ?? ''}
                                  placeholder={defaultConfig?.temperature ? `${defaultConfig.temperature}` : '0.7'}
                                  className="h-9"
                                  onChange={(e) => {
                                    const value = e.target.value ? parseFloat(e.target.value) : null;
                                    const updatedConfig = {
                                      modelName: userConfig?.name || null,
                                      maxTokens: userConfig?.max_tokens || null,
                                      temperature: value,
                                      reasoningEffort: userConfig?.reasoning_effort || null,
                                      fallbackModel: userConfig?.fallback_model || null
                                    };
                                    saveModelConfig(config.key, updatedConfig);
                                  }}
                                />
                                <div className="space-y-1">
                                  {defaultConfig?.temperature && (
                                    <p className="text-xs text-muted-foreground">
                                      🔧 System default: {defaultConfig.temperature}
                                    </p>
                                  )}
                                  {getParameterGuidance('temperature', config.key) && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      💡 {getParameterGuidance('temperature', config.key)}
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
                                  value={userConfig?.max_tokens ?? ''}
                                  placeholder={defaultConfig?.max_tokens ? `${defaultConfig.max_tokens}` : '4000'}
                                  className="h-9"
                                  onChange={(e) => {
                                    const value = e.target.value ? parseInt(e.target.value) : null;
                                    const updatedConfig = {
                                      modelName: userConfig?.name || null,
                                      maxTokens: value,
                                      temperature: userConfig?.temperature ?? null,
                                      reasoningEffort: userConfig?.reasoning_effort || null,
                                      fallbackModel: userConfig?.fallback_model || null
                                    };
                                    saveModelConfig(config.key, updatedConfig);
                                  }}
                                />
                                <div className="space-y-1">
                                  {defaultConfig?.max_tokens && (
                                    <p className="text-xs text-muted-foreground">
                                      🔧 System default: {defaultConfig.max_tokens?.toLocaleString()}
                                    </p>
                                  )}
                                  {getParameterGuidance('maxTokens', config.key) && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      💡 {getParameterGuidance('maxTokens', config.key)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Reasoning Effort</Label>
                                <Select
                                  value={userConfig?.reasoning_effort || 'default'}
                                  onValueChange={(value) => {
                                    const updatedConfig = {
                                      modelName: userConfig?.name || null,
                                      maxTokens: userConfig?.max_tokens || null,
                                      temperature: userConfig?.temperature ?? null,
                                      reasoningEffort: value === 'default' ? null : value,
                                      fallbackModel: userConfig?.fallback_model || null
                                    };
                                    saveModelConfig(config.key, updatedConfig);
                                  }}
                                >
                                  <SelectTrigger className="h-9">
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
                                  {getParameterGuidance('reasoningEffort', config.key) && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                      💡 {getParameterGuidance('reasoningEffort', config.key)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-3">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs"
                              onClick={() => testModelConfig(config.key)}
                              disabled={testingConfig === config.key}
                            >
                              {testingConfig === config.key ? (
                                <>
                                  <Settings className="h-3 w-3 animate-spin mr-1" />
                                  Testing...
                                </>
                              ) : (
                                'Test Config'
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 text-xs text-muted-foreground"
                              onClick={() => resetConfigToDefault(config.key)}
                              disabled={!isUserOverride}
                            >
                              Reset to Default
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline"
                    onClick={resetAllConfigs}
                    disabled={savingConfigs}
                  >
                    {savingConfigs ? 'Resetting...' : 'Reset All to Defaults'}
                  </Button>
                  <div className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                    Configurations are automatically saved on change
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Secrets Section */}
          <Card id="secrets">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5" />
                <div>
                  <CardTitle>API Keys & Secrets</CardTitle>
                  <CardDescription>Manage your API keys for code generation (Cloudflare, Stripe, OpenAI, etc.)</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Setup for Cloudflare */}
              <div className="rounded-lg bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border border-orange-200 dark:border-orange-800 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">☁️</div>
                  <div className="flex-1">
                    <h4 className="font-medium text-orange-900 dark:text-orange-100">Cloudflare Setup Required</h4>
                    <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      To deploy your generated apps, please add your Cloudflare API Key and Account ID
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Dialog open={secretDialog} onOpenChange={setSecretDialog}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                            onClick={() => {
                              setSelectedTemplate('CLOUDFLARE_API_KEY');
                              setIsCustomSecret(false);
                              setNewSecret({
                                templateId: 'CLOUDFLARE_API_KEY',
                                name: '',
                                envVarName: '',
                                value: '',
                                environment: 'production',
                                description: ''
                              });
                              setSecretDialog(true);
                            }}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Cloudflare Keys
                          </Button>
                        </DialogTrigger>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Secrets List */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Your API Keys</h4>
                  <Dialog open={secretDialog} onOpenChange={(open) => {
                    if (open) {
                      setSelectedTemplate(null);
                      setIsCustomSecret(false);
                      setNewSecret({
                        templateId: '',
                        name: '',
                        envVarName: '',
                        value: '',
                        environment: 'production',
                        description: ''
                      });
                    }
                    setSecretDialog(open);
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-2">
                        <Plus className="h-4 w-4" />
                        Add Secret
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
                
                {userSecrets.loading ? (
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading secrets...</span>
                  </div>
                ) : userSecrets.secrets.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-muted rounded-lg">
                    <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No API keys added yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add your service API keys to enable code generation features
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {userSecrets.secrets.map((secret) => (
                      <div key={secret.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                        <div className="flex items-center gap-3">
                          <div className="text-xl">{getProviderIcon(secret.provider)}</div>
                          <div>
                            <p className="font-medium">{secret.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {secret.provider}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {secret.secretType.replace('_', ' ')}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {secret.keyPreview}
                              </span>
                            </div>
                            {secret.description && (
                              <p className="text-xs text-muted-foreground mt-1">{secret.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {secret.environment}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Secret</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{secret.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handleDeleteSecret(secret.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Secret Dialog */}
              <Dialog open={secretDialog} onOpenChange={resetSecretDialog}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add API Key or Secret</DialogTitle>
                    <DialogDescription>
                      Choose a predefined template or add a custom environment variable
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Step 1: Template Selection */}
                    {!selectedTemplate && !isCustomSecret && (
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-3">Quick Setup (Recommended)</h4>
                          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                            {secretTemplates
                              .sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0))
                              .map((template) => (
                              <Button
                                key={template.id}
                                variant="outline"
                                className="justify-start h-auto p-3 text-left"
                                onClick={() => {
                                  setSelectedTemplate(template.id);
                                  setNewSecret(prev => ({
                                    ...prev,
                                    templateId: template.id,
                                    environment: 'production'
                                  }));
                                }}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <span className="text-lg">{template.icon}</span>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{template.displayName}</span>
                                      {template.required && (
                                        <Badge variant="secondary" className="text-xs">Required</Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {template.description}
                                    </p>
                                  </div>
                                </div>
                              </Button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="relative">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-background px-2 text-muted-foreground">
                              Or
                            </span>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          className="w-full justify-start h-auto p-3"
                          onClick={() => setIsCustomSecret(true)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">🔑</span>
                            <div className="text-left">
                              <div className="font-medium">Custom Environment Variable</div>
                              <p className="text-xs text-muted-foreground">
                                Add any custom API key or secret with your own variable name
                              </p>
                            </div>
                          </div>
                        </Button>
                      </div>
                    )}

                    {/* Step 2: Template Form */}
                    {selectedTemplate && (
                      <div className="space-y-4">
                        {(() => {
                          const template = secretTemplates.find(t => t.id === selectedTemplate);
                          if (!template) return null;
                          
                          return (
                            <>
                              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                <span className="text-xl">{template.icon}</span>
                                <div>
                                  <h4 className="font-medium">{template.displayName}</h4>
                                  <p className="text-sm text-muted-foreground">{template.description}</p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedTemplate(null);
                                    setNewSecret(prev => ({ ...prev, templateId: '', value: '' }));
                                  }}
                                >
                                  Change
                                </Button>
                              </div>
                              
                              <div className="space-y-3">
                                <div>
                                  <Label>Environment Variable Name</Label>
                                  <Input value={template.envVarName} disabled className="bg-muted" />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    This will be available as <code className="bg-muted px-1 rounded text-xs">{template.envVarName}</code> in your generated apps
                                  </p>
                                </div>
                                
                                <div>
                                  <Label htmlFor="templateValue">Value</Label>
                                  <div className="relative">
                                    <Input
                                      id="templateValue"
                                      type={showSecretValue ? "text" : "password"}
                                      placeholder={template.placeholder}
                                      value={newSecret.value}
                                      onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
                                      className="pr-10"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                      onClick={() => setShowSecretValue(!showSecretValue)}
                                    >
                                      {showSecretValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                </div>
                                
                                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                                  <h5 className="font-medium text-blue-900 dark:text-blue-100 text-sm mb-1">How to get this:</h5>
                                  <p className="text-xs text-blue-700 dark:text-blue-300">{template.instructions}</p>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Step 3: Custom Secret Form */}
                    {isCustomSecret && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Custom Environment Variable</h4>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setIsCustomSecret(false);
                              setNewSecret(prev => ({ ...prev, name: '', envVarName: '', value: '' }));
                            }}
                          >
                            Back
                          </Button>
                        </div>
                        
                        <div>
                          <Label htmlFor="customName">Display Name</Label>
                          <Input
                            id="customName"
                            placeholder="e.g., My Custom API Key"
                            value={newSecret.name}
                            onChange={(e) => setNewSecret(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="customEnvVar">Environment Variable Name</Label>
                          <Input
                            id="customEnvVar"
                            placeholder="e.g., MY_API_KEY"
                            value={newSecret.envVarName}
                            onChange={(e) => setNewSecret(prev => ({ ...prev, envVarName: e.target.value.toUpperCase() }))}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Must be uppercase letters, numbers, and underscores only
                          </p>
                        </div>
                        
                        <div>
                          <Label htmlFor="customValue">Value</Label>
                          <div className="relative">
                            <Input
                              id="customValue"
                              type={showSecretValue ? "text" : "password"}
                              placeholder="Enter your API key or secret"
                              value={newSecret.value}
                              onChange={(e) => setNewSecret(prev => ({ ...prev, value: e.target.value }))}
                              className="pr-10"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                              onClick={() => setShowSecretValue(!showSecretValue)}
                            >
                              {showSecretValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        
                        <div>
                          <Label htmlFor="customDescription">Description (Optional)</Label>
                          <Textarea
                            id="customDescription"
                            placeholder="Brief description of this secret"
                            value={newSecret.description}
                            onChange={(e) => setNewSecret(prev => ({ ...prev, description: e.target.value }))}
                            rows={2}
                          />
                        </div>
                      </div>
                    )}

                    {/* Environment Selection (for both template and custom) */}
                    {(selectedTemplate || isCustomSecret) && (
                      <div>
                        <Label htmlFor="environment">Environment</Label>
                        <Select value={newSecret.environment} onValueChange={(value) => setNewSecret(prev => ({ ...prev, environment: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="sandbox">Sandbox</SelectItem>
                            <SelectItem value="test">Test</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={resetSecretDialog}>
                      Cancel
                    </Button>
                    {(selectedTemplate || isCustomSecret) && (
                      <Button 
                        onClick={handleSaveSecret}
                        disabled={
                          !newSecret.value || 
                          (isCustomSecret && (!newSecret.name || !newSecret.envVarName)) ||
                          isSavingSecret
                        }
                      >
                        {isSavingSecret ? 'Saving...' : 'Save Secret'}
                      </Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card id="security">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5" />
                <div>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>Manage your account security and access</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Connected Accounts */}
              <div className="space-y-4">
                <h4 className="font-medium">Connected Accounts</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {user?.provider === 'google' ? '🇬' : '🐙'}
                    </div>
                    <div>
                      <p className="font-medium capitalize">{user?.provider}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">Connected</Badge>
                </div>
              </div>

              <Separator />

              {/* Active Sessions */}
              <div className="space-y-4">
                <h4 className="font-medium">Active Sessions</h4>
                {activeSessions.loading ? (
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading active sessions...</span>
                  </div>
                ) : (
                  activeSessions.sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {session.isCurrent ? 'Current Session' : 'Other Session'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {session.ipAddress} • {new Date(session.lastActivity).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.isCurrent ? (
                          <Badge variant="default">Current</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeSession(session.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <Separator />

              {/* API Keys */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">API Keys</h4>
                  <Button onClick={handleCreateApiKey} size="sm" className="gap-2">
                    <Key className="h-4 w-4" />
                    Create API Key
                  </Button>
                </div>
                
                {apiKeys.loading ? (
                  <div className="flex items-center gap-3">
                    <Settings className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading API keys...</span>
                  </div>
                ) : apiKeys.keys.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No API keys created yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Create an API key to access your apps programmatically
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {apiKeys.keys.map((key) => (
                      <div key={key.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{key.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {key.keyPreview} • Created {new Date(key.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={key.isActive ? "default" : "secondary"}>
                            {key.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeApiKey(key.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Danger Zone */}
              <div className="space-y-4">
                <h4 className="font-medium text-destructive">Danger Zone</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sign out</p>
                    <p className="text-sm text-muted-foreground">
                      Sign out of your account
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={handleLogout}
                    className="gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete Account
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete your
                          account and remove all your data from our servers.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete Account
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}