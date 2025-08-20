/**
 * Centralized API types - imports and re-exports types from worker
 * This file serves as the single source of truth for frontend-worker API communication
 */

// Base API Response Types
export type { ControllerResponse, ApiResponse } from 'worker/api/controllers/BaseController.types';

// App-related API Types
export type { 
  AppsListData,
  PublicAppsData, 
  SingleAppData,
  FavoriteToggleData,
  CreateAppData,
  UpdateAppVisibilityData,
  AppWithUserAndStats
} from 'worker/api/controllers/apps/types';

export type {
  AppDetailsData,
  AppStarToggleData,
  ForkAppData,
  GeneratedCodeFile
} from 'worker/api/controllers/appView/types';

// User-related API Types
export type {
  DashboardData,
  UserAppsData,
  AgentSessionData,
  ProfileUpdateData,
  UserTeamsData
} from 'worker/api/controllers/user/types';

// Stats API Types
export type {
  UserStatsData,
  UserActivityData
} from 'worker/api/controllers/stats/types';

// Model Config API Types
export type {
  ModelConfigsData,
  ModelConfigData,
  ModelConfigUpdateData,
  ModelConfigTestData,
  ModelConfigResetData,
  ModelConfigDefaultsData,
  ModelConfigDeleteData
} from 'worker/api/controllers/modelConfig/types';

// Secrets API Types
export type {
  SecretsData,
  SecretStoreData,
  SecretDeleteData,
  SecretTemplatesData,
  SecretTemplate
} from 'worker/api/controllers/secrets/types';

// GitHub Integration API Types
export type {
  GitHubIntegrationStatusData,
  GitHubIntegrationRemovalData,
  GitHubIntegrationInput
} from 'worker/api/controllers/githubIntegration/types';

// Agent/CodeGen API Types  
export type {
  AgentStateData,
  AgentConnectionData,
  CodeGenerationResponse,
  AgentConnectionResponse
} from 'worker/api/controllers/agent/types';

// WebSocket Types
export type { 
  WebSocketMessage, 
  CodeFixEdits 
} from 'worker/api/websocketTypes';

// Database/Schema Types commonly used in frontend
export type { 
  App,
  User,
  CodeGenInstance,
  UserModelConfig
} from 'worker/database/schema';

export type {
  EnhancedAppData,
  AppWithFavoriteStatus,
  PaginationInfo,
  FavoriteToggleResult,
  EnhancedUserStats,
  UserActivity,
  UserTeamData,
  EncryptedSecret,
  UserModelConfigWithMetadata,
  ModelTestResult
} from 'worker/database/types';

// Agent/Generator Types
export type { 
  Blueprint as BlueprintType,
  ClientReportedErrorType,
  CodeReviewOutputType,
  FileConceptType,
  FileOutputType as GeneratedFile,
  TechnicalInstructionType
} from 'worker/agents/schemas';

export type { 
  CodeGenState 
} from 'worker/agents/core/state';

export type { 
  RuntimeError,
  StaticAnalysisResponse 
} from 'worker/services/sandbox/sandboxTypes';

// Config/Inference Types
export type { 
  AgentActionKey,
  ModelConfig,
  ReasoningEffortType as ReasoningEffort,
  ProviderOverrideType as ProviderOverride
} from 'worker/agents/inferutils/config.types';

// Streaming response wrapper types for agent session creation
export interface StreamingResponse {
  success: true;
  stream: Response;
}

export interface StreamingError {
  success: false;
  error: string;
  statusCode: number;
}

export type AgentStreamingResponse = StreamingResponse | StreamingError;