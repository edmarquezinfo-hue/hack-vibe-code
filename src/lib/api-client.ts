/**
 * Unified API Client - Premium quality abstraction for all worker API calls
 * Provides type-safe methods for all endpoints with proper error handling
 * Features 401 response interception to trigger authentication modals
 */

import type {
  ApiResponse,
  AppsListData,
  PublicAppsData,
  FavoriteToggleData,
  CreateAppData,
  UpdateAppVisibilityData,
  AppDeleteData,
  AppDetailsData,
  AppStarToggleData,
  ForkAppData,
  UserAppsData,
  ProfileUpdateData,
  UserTeamsData,
  UserStatsData,
  UserActivityData,
  UserAnalyticsResponseData,
  AgentAnalyticsResponseData,
  ModelConfigsData,
  ModelConfigData,
  ModelConfigUpdateData,
  ModelConfigTestData,
  ModelConfigResetData,
  ModelConfigDefaultsData,
  ModelConfigDeleteData,
  ByokProvidersData,
  ModelConfigUpdate,
  ModelProvidersListData,
  ModelProviderCreateData,
  ModelProviderUpdateData,
  ModelProviderDeleteData,
  ModelProviderTestData,
  CreateProviderRequest,
  UpdateProviderRequest,
  TestProviderRequest,
  SecretsData,
  SecretStoreData,
  SecretDeleteData,
  SecretTemplatesData,
  GitHubIntegrationStatusData,
  GitHubIntegrationRemovalData,
  AgentStateData,
  AgentConnectionData,
  AgentStreamingResponse,
  App,
  ActiveSessionsData,
  ApiKeysData,
  LoginResponseData,
  RegisterResponseData,
  ProfileResponseData,
  AuthProvidersResponseData,
  OAuthProvider
} from '@/api-types';
import { AgentPreviewResponse } from 'worker/api/controllers/agent/types';

/**
 * Global auth modal trigger for 401 interception
 */
let globalAuthModalTrigger: ((context?: string) => void) | null = null;

export function setGlobalAuthModalTrigger(trigger: (context?: string) => void) {
  globalAuthModalTrigger = trigger;
}

/**
 * API Client Error class with proper error context
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message: string,
    public endpoint: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Base API client configuration
 */
interface ApiClientConfig {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

/**
 * Request options for API calls
 */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  credentials?: RequestCredentials;
}

/**
 * Pagination parameters for paginated endpoints
 */
interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * User apps parameters with filtering and sorting
 */
interface UserAppsParams extends PaginationParams {
  period?: 'today' | 'week' | 'month' | 'all';
  framework?: string;
  search?: string;
  visibility?: 'private' | 'public' | 'team' | 'board';
  status?: 'generating' | 'completed';
  teamId?: string;
}

/**
 * Public apps parameters with filtering and sorting
 */
interface PublicAppsParams extends PaginationParams {
  period?: 'today' | 'week' | 'month' | 'all';
  framework?: string;
  search?: string;
  boardId?: string;
}

/**
 * Unified API Client class
 */
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || '';
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config.defaultHeaders,
    };
  }

  /**
   * Get authentication headers for API requests
   */
  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Add session token for anonymous users if not authenticated
    // This will be handled automatically by cookies/credentials for authenticated users
    const sessionToken = localStorage.getItem('anonymous_session_token');
    if (sessionToken && !document.cookie.includes('session=')) {
      headers['X-Session-Token'] = sessionToken;
    }
    
    return headers;
  }

  /**
   * Ensure session token exists for anonymous users
   */
  private ensureSessionToken(): void {
    if (!localStorage.getItem('anonymous_session_token') && !document.cookie.includes('session=')) {
      localStorage.setItem('anonymous_session_token', crypto.randomUUID());
    }
  }

  /**
   * Get authentication context message based on endpoint
   */
  private getAuthContextForEndpoint(endpoint: string): string {
    if (endpoint.includes('/api/agent')) return 'to create applications';
    if (endpoint.includes('/favorite')) return 'to favorite this app';
    if (endpoint.includes('/star')) return 'to star this app';
    if (endpoint.includes('/fork')) return 'to fork this app';
    // if (endpoint.includes('/apps')) return 'to access your apps';
    if (endpoint.includes('/profile')) return 'to access your profile';
    if (endpoint.includes('/settings')) return 'to access settings';
    return 'to continue';
  }

  /**
   * Check if endpoint should trigger auth modal on 401
   * Auth checking endpoints should not auto-trigger modals
   */
  private shouldTriggerAuthModal(endpoint: string): boolean {
    // Don't trigger modal for auth state checking endpoints
    if (endpoint === '/api/auth/profile') return false;
    if (endpoint === '/api/auth/providers') return false;
    if (endpoint === '/api/auth/sessions') return false;
    
    return true;
  }

  /**
   * Make HTTP request with proper error handling and type safety
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // Ensure session token exists for anonymous users
    this.ensureSessionToken();
    
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      method: options.method || 'GET',
      headers: {
        ...this.defaultHeaders,
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      credentials: options.credentials || 'include',
    };

    if (options.body) {
      config.body = typeof options.body === 'string' 
        ? options.body 
        : JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Intercept 401 responses and trigger auth modal (but not for auth checking endpoints)
        if (response.status === 401 && globalAuthModalTrigger && this.shouldTriggerAuthModal(endpoint)) {
          // Determine context based on endpoint
          const authContext = this.getAuthContextForEndpoint(endpoint);
          globalAuthModalTrigger(authContext);
        }

        throw new ApiError(
          response.status,
          response.statusText,
          data.error || data.message || 'Request failed',
          endpoint
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(0, 'Network Error', error instanceof Error ? error.message : 'Unknown error', endpoint);
    }
  }

  // ===============================
  // Apps API Methods
  // ===============================

  /**
   * Get all apps for the current user
   */
  async getUserApps(): Promise<ApiResponse<AppsListData>> {
    return this.request<AppsListData>('/api/apps');
  }

  /**
   * Get recent apps (last 10)
   */
  async getRecentApps(): Promise<ApiResponse<AppsListData>> {
    return this.request<AppsListData>('/api/apps/recent');
  }

  /**
   * Get favorite apps
   */
  async getFavoriteApps(): Promise<ApiResponse<AppsListData>> {
    return this.request<AppsListData>('/api/apps/favorites');
  }

  /**
   * Get public apps feed with pagination
   */
  async getPublicApps(params?: PublicAppsParams): Promise<ApiResponse<PublicAppsData>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.sort) queryParams.set('sort', params.sort);
    if (params?.order) queryParams.set('order', params.order);
    if (params?.period) queryParams.set('period', params.period);
    if (params?.framework) queryParams.set('framework', params.framework);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.boardId) queryParams.set('boardId', params.boardId);
    
    const endpoint = `/api/apps/public${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<PublicAppsData>(endpoint);
  }

  /**
   * Create a new app
   */
  async createApp(data: { title: string; description?: string }): Promise<ApiResponse<CreateAppData>> {
    return this.request<CreateAppData>('/api/apps', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Toggle favorite status of an app
   */
  async toggleFavorite(appId: string): Promise<ApiResponse<FavoriteToggleData>> {
    return this.request<FavoriteToggleData>(`/api/apps/${appId}/favorite`, {
      method: 'POST',
    });
  }

  /**
   * Update app visibility
   */
  async updateAppVisibility(
    appId: string, 
    visibility: App['visibility']
  ): Promise<ApiResponse<UpdateAppVisibilityData>> {
    return this.request<UpdateAppVisibilityData>(`/api/apps/${appId}/visibility`, {
      method: 'PUT',
      body: { visibility },
    });
  }

  /**
   * Delete an app
   */
  async deleteApp(appId: string): Promise<ApiResponse<AppDeleteData>> {
    return this.request<AppDeleteData>(`/api/apps/${appId}`, {
      method: 'DELETE',
    });
  }

  // ===============================
  // App View API Methods
  // ===============================

  /**
   * Get detailed app information for viewing
   */
  async getAppDetails(appId: string): Promise<ApiResponse<AppDetailsData>> {
    return this.request<AppDetailsData>(`/api/apps/${appId}`);
  }

  /**
   * Toggle star status of an app (different from favorite)
   */
  async toggleAppStar(appId: string): Promise<ApiResponse<AppStarToggleData>> {
    return this.request<AppStarToggleData>(`/api/apps/${appId}/star`, {
      method: 'POST',
    });
  }

  /**
   * Fork an app
   */
  async forkApp(appId: string): Promise<ApiResponse<ForkAppData>> {
    return this.request<ForkAppData>(`/api/apps/${appId}/fork`, {
      method: 'POST',
    });
  }

  // ===============================
  // User API Methods
  // ===============================


  /**
   * Get user apps with pagination
   */
  async getUserAppsWithPagination(params?: UserAppsParams): Promise<ApiResponse<UserAppsData>> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.sort) queryParams.set('sort', params.sort);
    if (params?.order) queryParams.set('order', params.order);
    if (params?.period) queryParams.set('period', params.period);
    if (params?.framework) queryParams.set('framework', params.framework);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.visibility) queryParams.set('visibility', params.visibility);
    if (params?.status) queryParams.set('status', params.status);
    if (params?.teamId) queryParams.set('teamId', params.teamId);
    
    const endpoint = `/api/user/apps${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.request<UserAppsData>(endpoint);
  }

  /**
   * Create new agent session for code generation
   * Returns a wrapper with success/error info and the streaming response
   */
  async createAgentSession(data: { 
    query: string; 
    agentMode?: 'deterministic' | 'smart';
    language?: string;
    frameworks?: string[];
    selectedTemplate?: string;
  }): Promise<AgentStreamingResponse> {
    // Ensure session token exists for anonymous users
    this.ensureSessionToken();
    
    const url = `${this.baseUrl}/api/agent`;
    const config: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        
        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
        };
      }
      
      // Return the streaming response wrapped in success indicator
      return {
        success: true,
        stream: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        statusCode: 0,
      };
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: { 
    displayName?: string; 
    username?: string;
    bio?: string; 
    timezone?: string;
    theme?: 'light' | 'dark' | 'system';
  }): Promise<ApiResponse<ProfileUpdateData>> {
    return this.request<ProfileUpdateData>('/api/user/profile', {
      method: 'PUT',
      body: data,
    });
  }

  /**
   * Get user teams
   */
  async getUserTeams(): Promise<ApiResponse<UserTeamsData>> {
    return this.request<UserTeamsData>('/api/user/teams');
  }

  // ===============================
  // Stats API Methods
  // ===============================

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<ApiResponse<UserStatsData>> {
    return this.request<UserStatsData>('/api/stats/user');
  }

  /**
   * Get user activity timeline
   */
  async getUserActivity(): Promise<ApiResponse<UserActivityData>> {
    return this.request<UserActivityData>('/api/stats/activity');
  }

  // ===============================
  // Analytics API Methods
  // ===============================

  /**
   * Get user analytics (AI Gateway costs and usage)
   */
  async getUserAnalytics(userId: string, days?: number): Promise<ApiResponse<UserAnalyticsResponseData>> {
    const queryParams = days ? `?days=${days}` : '';
    return this.request<UserAnalyticsResponseData>(`/api/user/${userId}/analytics${queryParams}`);
  }

  /**
   * Get agent analytics (AI Gateway costs and usage for specific app/chat)
   */
  async getAgentAnalytics(agentId: string, days?: number): Promise<ApiResponse<AgentAnalyticsResponseData>> {
    const queryParams = days ? `?days=${days}` : '';
    return this.request<AgentAnalyticsResponseData>(`/api/agent/${agentId}/analytics${queryParams}`);
  }

  // ===============================
  // Model Config API Methods
  // ===============================

  /**
   * Get all model configurations
   */
  async getModelConfigs(): Promise<ApiResponse<ModelConfigsData>> {
    return this.request<ModelConfigsData>('/api/model-configs');
  }

  /**
   * Get BYOK providers and available models
   */
  async getByokProviders(): Promise<ApiResponse<ByokProvidersData>> {
    return this.request<ByokProvidersData>('/api/model-configs/byok-providers');
  }

  /**
   * Get BYOK templates for dynamic provider configuration
   */
  async getBYOKTemplates(): Promise<ApiResponse<SecretTemplatesData>> {
    return this.request<SecretTemplatesData>('/api/secrets/templates?category=byok');
  }


  /**
   * Reset model configuration to default
   */
  async resetModelConfig(agentAction: string): Promise<ApiResponse<ModelConfigResetData>> {
    return this.request<ModelConfigResetData>(`/api/model-configs/${agentAction}`, {
      method: 'DELETE',
    });
  }

  /**
   * Reset all model configurations to defaults
   */
  async resetAllModelConfigs(): Promise<ApiResponse<ModelConfigResetData>> {
    return this.request<ModelConfigResetData>('/api/model-configs/reset-all', {
      method: 'POST',
    });
  }

  /**
   * Get specific model configuration
   */
  async getModelConfig(actionKey: string): Promise<ApiResponse<ModelConfigData>> {
    return this.request<ModelConfigData>(`/api/model-configs/${actionKey}`);
  }

  /**
   * Update model configuration
   */
  async updateModelConfig(actionKey: string, config: ModelConfigUpdate): Promise<ApiResponse<ModelConfigUpdateData>> {
    return this.request<ModelConfigUpdateData>(`/api/model-configs/${actionKey}`, {
      method: 'PUT',
      body: config,
    });
  }

  /**
   * Test model configuration
   */
  async testModelConfig(actionKey: string, tempConfig?: ModelConfigUpdate): Promise<ApiResponse<ModelConfigTestData>> {
    return this.request<ModelConfigTestData>('/api/model-configs/test', {
      method: 'POST',
      body: { 
        agentActionName: actionKey, 
        useUserKeys: true,
        ...(tempConfig && { tempConfig })
      },
    });
  }

  /**
   * Reset all model configurations
   */
  async resetAllConfigs(): Promise<ApiResponse<ModelConfigResetData>> {
    return this.request<ModelConfigResetData>('/api/model-configs/reset-all', {
      method: 'POST',
    });
  }

  /**
   * Get default model configurations
   */
  async getModelDefaults(): Promise<ApiResponse<ModelConfigDefaultsData>> {
    return this.request<ModelConfigDefaultsData>('/api/model-configs/defaults');
  }

  /**
   * Delete model configuration
   */
  async deleteModelConfig(actionKey: string): Promise<ApiResponse<ModelConfigDeleteData>> {
    return this.request<ModelConfigDeleteData>(`/api/model-configs/${actionKey}`, {
      method: 'DELETE',
    });
  }

  // ===============================
  // Model Providers API Methods
  // ===============================
  
  /**
   * Get all custom model providers
   */
  async getModelProviders(): Promise<ApiResponse<ModelProvidersListData>> {
    return this.request<ModelProvidersListData>('/api/user/providers');
  }

  /**
   * Create a new custom model provider
   */
  async createModelProvider(data: CreateProviderRequest): Promise<ApiResponse<ModelProviderCreateData>> {
    return this.request<ModelProviderCreateData>('/api/user/providers', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Update an existing model provider
   */
  async updateModelProvider(providerId: string, data: UpdateProviderRequest): Promise<ApiResponse<ModelProviderUpdateData>> {
    return this.request<ModelProviderUpdateData>(`/api/user/providers/${providerId}`, {
      method: 'PUT',
      body: data,
    });
  }

  /**
   * Delete a model provider
   */
  async deleteModelProvider(providerId: string): Promise<ApiResponse<ModelProviderDeleteData>> {
    return this.request<ModelProviderDeleteData>(`/api/user/providers/${providerId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test a model provider connection
   */
  async testModelProvider(data: TestProviderRequest): Promise<ApiResponse<ModelProviderTestData>> {
    return this.request<ModelProviderTestData>('/api/user/providers/test', {
      method: 'POST',
      body: data,
    });
  }

  // ===============================
  // Secrets API Methods
  // ===============================

  /**
   * Get all user secrets
   */
  async getSecrets(): Promise<ApiResponse<SecretsData>> {
    return this.request<SecretsData>('/api/secrets');
  }

  /**
   * Get all user secrets including inactive ones (for management)
   */
  async getAllSecrets(): Promise<ApiResponse<SecretsData>> {
    return this.request<SecretsData>('/api/secrets/all');
  }

  /**
   * Store a new secret
   */
  async storeSecret(data: { 
    templateId?: string;
    name?: string;
    envVarName?: string;
    value: string;
    environment?: string;
    description?: string;
  }): Promise<ApiResponse<SecretStoreData>> {
    return this.request<SecretStoreData>('/api/secrets', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Delete a secret
   */
  async deleteSecret(secretId: string): Promise<ApiResponse<SecretDeleteData>> {
    return this.request<SecretDeleteData>(`/api/secrets/${secretId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Toggle secret active status
   */
  async toggleSecret(secretId: string): Promise<ApiResponse<SecretStoreData>> {
    return this.request<SecretStoreData>(`/api/secrets/${secretId}/toggle`, {
      method: 'PATCH',
    });
  }

  /**
   * Get secret templates
   */
  async getSecretTemplates(): Promise<ApiResponse<SecretTemplatesData>> {
    return this.request<SecretTemplatesData>('/api/secrets/templates');
  }

  // ===============================
  // GitHub Integration API Methods
  // ===============================

  /**
   * Get GitHub integration status
   */
  async getGitHubIntegrationStatus(): Promise<ApiResponse<GitHubIntegrationStatusData>> {
    return this.request<GitHubIntegrationStatusData>('/api/integrations/github/status');
  }

  /**
   * Remove GitHub integration
   */
  async removeGitHubIntegration(): Promise<ApiResponse<GitHubIntegrationRemovalData>> {
    return this.request<GitHubIntegrationRemovalData>('/api/integrations/github', {
      method: 'DELETE',
    });
  }

  // ===============================
  // Agent/CodeGen API Methods
  // ===============================

  /**
   * Get agent state
   */
  async getAgentState(agentId: string): Promise<ApiResponse<AgentStateData>> {
    return this.request<AgentStateData>(`/api/agent/${agentId}`);
  }

  /**
   * Connect to existing agent
   */
  async connectToAgent(agentId: string): Promise<ApiResponse<AgentConnectionData>> {
    return this.request<AgentConnectionData>(`/api/agent/${agentId}/connect`);
  }

  /**
   * Deploy preview
   */
  async deployPreview(agentId: string): Promise<ApiResponse<AgentPreviewResponse>> {
    return this.request<AgentPreviewResponse>(`/api/agent/${agentId}/preview`);
  }

  // ===============================
  // Session Management API Methods
  // ===============================

  /**
   * Get active user sessions
   */
  async getActiveSessions(): Promise<ApiResponse<ActiveSessionsData>> {
    return this.request<ActiveSessionsData>('/api/auth/sessions');
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // ===============================
  // API Keys Management Methods  
  // ===============================

  /**
   * Get user API keys
   */
  async getApiKeys(): Promise<ApiResponse<ApiKeysData>> {
    return this.request<ApiKeysData>('/api/auth/api-keys');
  }

  /**
   * Create a new API key
   */
  async createApiKey(data: { name: string }): Promise<ApiResponse<{ key: string; keyPreview: string; name: string; message: string }>> {
    return this.request<{ key: string; keyPreview: string; name: string; message: string }>('/api/auth/api-keys', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>(`/api/auth/api-keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  // ===============================
  // Authentication API Methods
  // ===============================

  /**
   * Login with email and password
   */
  async loginWithEmail(credentials: { email: string; password: string }): Promise<ApiResponse<LoginResponseData>> {
    return this.request<LoginResponseData>('/api/auth/login', {
      method: 'POST',
      body: credentials,
    });
  }

  /**
   * Register a new user
   */
  async register(data: { email: string; password: string; name?: string }): Promise<ApiResponse<RegisterResponseData>> {
    return this.request<RegisterResponseData>('/api/auth/register', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Verify email with OTP
   */
  async verifyEmail(data: { email: string; otp: string }): Promise<ApiResponse<LoginResponseData>> {
    return this.request<LoginResponseData>('/api/auth/verify-email', {
      method: 'POST',
      body: data,
    });
  }

  /**
   * Resend verification OTP
   */
  async resendVerificationOtp(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: { email },
    });
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<ApiResponse<ProfileResponseData>> {
    return this.request<ProfileResponseData>('/api/auth/profile');
  }

  /**
   * Logout current user
   */
  async logout(): Promise<ApiResponse<{ message: string }>> {
    return this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    });
  }

  /**
   * Get available authentication providers
   */
  async getAuthProviders(): Promise<ApiResponse<AuthProvidersResponseData>> {
    return this.request<AuthProvidersResponseData>('/api/auth/providers');
  }

  /**
   * Initiate OAuth flow (redirects to provider)
   */
  initiateOAuth(provider: OAuthProvider, redirectUrl?: string): void {
    const oauthUrl = new URL(`/api/auth/oauth/${provider}`, window.location.origin);
    if (redirectUrl) {
      oauthUrl.searchParams.set('redirect_url', redirectUrl);
    }
    
    // Redirect to OAuth provider
    window.location.href = oauthUrl.toString();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing/custom instances
export { ApiClient };