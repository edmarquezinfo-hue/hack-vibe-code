import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ========================================
// CORE USER AND IDENTITY MANAGEMENT
// ========================================

/**
 * Users table - Core user identity and profile information
 * Supports OAuth providers and user preferences
 */
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    username: text('username').unique(), // Optional username for public identity
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    
    // OAuth and Authentication
    provider: text('provider').notNull(), // 'github', 'google', 'email'
    providerId: text('provider_id').notNull(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
    passwordHash: text('password_hash'), // Only for provider: 'email'
    
    // Security enhancements
    failedLoginAttempts: integer('failed_login_attempts').default(0),
    lockedUntil: integer('locked_until', { mode: 'timestamp' }),
    passwordChangedAt: integer('password_changed_at', { mode: 'timestamp' }),
    
    // User Preferences and Settings
    preferences: text('preferences', { mode: 'json' }).default('{}'),
    theme: text('theme', { enum: ['light', 'dark', 'system'] }).default('system'),
    timezone: text('timezone').default('UTC'),
    
    // Account Status
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    isSuspended: integer('is_suspended', { mode: 'boolean' }).default(false),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    lastActiveAt: integer('last_active_at', { mode: 'timestamp' }),
    
    // Soft delete
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    providerIdx: uniqueIndex('users_provider_unique_idx').on(table.provider, table.providerId),
    usernameIdx: index('users_username_idx').on(table.username),
    failedLoginAttemptsIdx: index('users_failed_login_attempts_idx').on(table.failedLoginAttempts),
    lockedUntilIdx: index('users_locked_until_idx').on(table.lockedUntil),
    isActiveIdx: index('users_is_active_idx').on(table.isActive),
    lastActiveAtIdx: index('users_last_active_at_idx').on(table.lastActiveAt),
}));

/**
 * Sessions table - JWT session management with refresh token support
 */
export const sessions = sqliteTable('sessions', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Session Details
    deviceInfo: text('device_info'),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    
    // Security metadata
    isRevoked: integer('is_revoked', { mode: 'boolean' }).default(false),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
    revokedReason: text('revoked_reason'),
    
    // Token Management
    accessTokenHash: text('access_token_hash').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    
    // Timing
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    lastActivity: integer('last_activity', { mode: 'timestamp' }),
}, (table) => ({
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
    accessTokenHashIdx: index('sessions_access_token_hash_idx').on(table.accessTokenHash),
    refreshTokenHashIdx: index('sessions_refresh_token_hash_idx').on(table.refreshTokenHash),
    lastActivityIdx: index('sessions_last_activity_idx').on(table.lastActivity),
    isRevokedIdx: index('sessions_is_revoked_idx').on(table.isRevoked),
}));

/**
 * API Keys table - Manage user API keys for programmatic access
 */
export const apiKeys = sqliteTable('api_keys', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Key Details
    name: text('name').notNull(), // User-friendly name for the API key
    keyHash: text('key_hash').notNull().unique(), // Hashed API key for security
    keyPreview: text('key_preview').notNull(), // First few characters for display (e.g., "sk_prod_1234...")
    
    // Security and Access Control
    scopes: text('scopes').notNull(), // JSON array of allowed scopes
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    
    // Usage Tracking
    lastUsed: integer('last_used', { mode: 'timestamp' }),
    requestCount: integer('request_count').default(0), // Track usage
    
    // Timing
    expiresAt: integer('expires_at', { mode: 'timestamp' }), // Optional expiration
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    userIdIdx: index('api_keys_user_id_idx').on(table.userId),
    keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
    isActiveIdx: index('api_keys_is_active_idx').on(table.isActive),
    expiresAtIdx: index('api_keys_expires_at_idx').on(table.expiresAt),
}));

// ========================================
// TEAM AND ORGANIZATION MANAGEMENT
// ========================================

/**
 * Teams table - Organization/team accounts that users can belong to
 */
export const teams = sqliteTable('teams', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(), // URL-friendly identifier
    description: text('description'),
    avatarUrl: text('avatar_url'),
    
    // Team Settings
    visibility: text('visibility', { enum: ['private', 'public'] }).notNull().default('private'),
    allowMemberInvites: integer('allow_member_invites', { mode: 'boolean' }).default(false),
    
    // Billing and Limits (for future use)
    plan: text('plan', { enum: ['free', 'pro', 'enterprise'] }).default('free'),
    maxMembers: integer('max_members').default(5),
    maxApps: integer('max_apps').default(10),
    
    // Removed memberCount and appCount - use COUNT() queries with proper indexes instead
    
    // Ownership
    ownerId: text('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
}, (table) => ({
    slugIdx: uniqueIndex('teams_slug_idx').on(table.slug),
    ownerIdx: index('teams_owner_idx').on(table.ownerId),
    visibilityIdx: index('teams_visibility_idx').on(table.visibility),
}));

/**
 * TeamMembers table - Many-to-many relationship between users and teams
 */
export const teamMembers = sqliteTable('team_members', {
    id: text('id').primaryKey(),
    teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Membership Details
    role: text('role', { enum: ['owner', 'admin', 'member', 'viewer'] }).notNull().default('member'),
    permissions: text('permissions', { mode: 'json' }).default('[]'), // Array of specific permissions
    
    // Invitation Management
    invitedBy: text('invited_by').references(() => users.id),
    invitedAt: integer('invited_at', { mode: 'timestamp' }),
    joinedAt: integer('joined_at', { mode: 'timestamp' }),
    status: text('status', { enum: ['pending', 'active', 'suspended'] }).notNull().default('active'),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    teamUserIdx: uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId),
    userIdx: index('team_members_user_idx').on(table.userId),
    roleIdx: index('team_members_role_idx').on(table.role),
    statusIdx: index('team_members_status_idx').on(table.status),
}));

// ========================================
// CLOUDFLARE INTEGRATION
// ========================================

/**
 * CloudflareAccounts table - Store Cloudflare account configurations
 * Supports both user and team-level accounts
 */
export const cloudflareAccounts = sqliteTable('cloudflare_accounts', {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // User-friendly name for the account
    
    // Account Details
    accountId: text('account_id').notNull(), // Cloudflare Account ID
    apiTokenHash: text('api_token_hash').notNull(), // Encrypted/hashed API token
    
    // Ownership - either user or team
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    
    // Configuration
    isDefault: integer('is_default', { mode: 'boolean' }).default(false),
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    
    // Capabilities and Limits
    capabilities: text('capabilities', { mode: 'json' }).default('[]'), // What the token can do
    lastValidated: integer('last_validated', { mode: 'timestamp' }),
    validationStatus: text('validation_status').default('pending'), // 'valid', 'invalid', 'pending'
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    userIdx: index('cf_accounts_user_idx').on(table.userId),
    teamIdx: index('cf_accounts_team_idx').on(table.teamId),
    accountIdIdx: index('cf_accounts_account_id_idx').on(table.accountId),
}));

// ========================================
// GITHUB INTEGRATION (Future Support)
// ========================================

/**
 * GitHubIntegrations table - Store GitHub account integrations for export feature
 */
export const githubIntegrations = sqliteTable('github_integrations', {
    id: text('id').primaryKey(),
    
    // GitHub Account Details
    githubUserId: text('github_user_id').notNull(),
    githubUsername: text('github_username').notNull(),
    accessTokenHash: text('access_token_hash').notNull(), // Encrypted GitHub access token
    refreshTokenHash: text('refresh_token_hash'), // If using OAuth apps
    
    // Ownership - either user or team
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }),
    
    // Integration Settings
    defaultOrganization: text('default_organization'), // Default GitHub org for exports
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    
    // Token Management
    scopes: text('scopes', { mode: 'json' }).default('[]'), // GitHub scopes granted
    lastValidated: integer('last_validated', { mode: 'timestamp' }),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    userIdx: index('github_integrations_user_idx').on(table.userId),
    teamIdx: index('github_integrations_team_idx').on(table.teamId),
    githubUserIdx: index('github_integrations_github_user_idx').on(table.githubUserId),
}));

// ========================================
// COMMUNITY AND BOARDS
// ========================================

/**
 * Boards table - Organizational boards for sharing apps (like subreddits)
 */
export const boards = sqliteTable('boards', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    iconUrl: text('icon_url'),
    bannerUrl: text('banner_url'),
    
    // Board Configuration
    visibility: text('visibility', { enum: ['public', 'private', 'team_only'] }).notNull().default('public'),
    allowSubmissions: integer('allow_submissions', { mode: 'boolean' }).default(true),
    requireApproval: integer('require_approval', { mode: 'boolean' }).default(false),
    
    // Board Rules and Guidelines
    rules: text('rules'), // Markdown content
    guidelines: text('guidelines'), // Markdown content
    
    // Ownership and Moderation
    ownerId: text('owner_id').references(() => users.id),
    teamId: text('team_id').references(() => teams.id), // If it's a team board
    
    // Removed memberCount and appCount - use COUNT() queries with proper indexes instead
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    slugIdx: uniqueIndex('boards_slug_idx').on(table.slug),
    ownerIdx: index('boards_owner_idx').on(table.ownerId),
    teamIdx: index('boards_team_idx').on(table.teamId),
    visibilityIdx: index('boards_visibility_idx').on(table.visibility),
}));

/**
 * BoardMembers table - Board membership and moderation roles
 */
export const boardMembers = sqliteTable('board_members', {
    id: text('id').primaryKey(),
    boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Membership Details
    role: text('role', { enum: ['owner', 'moderator', 'member'] }).notNull().default('member'),
    permissions: text('permissions', { mode: 'json' }).default('[]'),
    
    // Member Status
    isBanned: integer('is_banned', { mode: 'boolean' }).default(false),
    bannedAt: integer('banned_at', { mode: 'timestamp' }),
    bannedReason: text('banned_reason'),
    
    // Metadata
    joinedAt: integer('joined_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    boardUserIdx: uniqueIndex('board_members_board_user_idx').on(table.boardId, table.userId),
    userIdx: index('board_members_user_idx').on(table.userId),
}));

// ========================================
// CORE APP AND GENERATION SYSTEM
// ========================================

/**
 * Apps table - Generated applications with comprehensive metadata
 */
export const apps = sqliteTable('apps', {
    id: text('id').primaryKey(),
    
    // App Identity
    title: text('title').notNull(),
    description: text('description'),
    slug: text('slug'), // URL-friendly identifier for public apps
    iconUrl: text('icon_url'), // App icon URL
    
    // Original Generation Data
    originalPrompt: text('original_prompt').notNull(), // The user's original request
    finalPrompt: text('final_prompt'), // The processed/refined prompt used for generation
    
    // Generated Content
    blueprint: text('blueprint', { mode: 'json' }), // The generated blueprint
    generatedFiles: text('generated_files', { mode: 'json' }), // Map of all generated files
    templateId: text('template_id'), // Template used for generation
    framework: text('framework'), // 'react', 'vue', 'svelte', etc.
    
    // Ownership and Context
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // Null for anonymous
    teamId: text('team_id').references(() => teams.id, { onDelete: 'cascade' }), // Team context if applicable
    sessionToken: text('session_token'), // For anonymous users
    
    // Visibility and Sharing
    visibility: text('visibility', { enum: ['private', 'team', 'board', 'public'] }).notNull().default('private'),
    boardId: text('board_id').references(() => boards.id), // If shared to a board
    
    // Status and State
    status: text('status', { enum: ['draft', 'generating', 'completed', 'deployed', 'error'] }).notNull().default('draft'),
    generationStatus: text('generation_status', { mode: 'json' }).default('{}'), // Detailed generation state
    
    // Deployment Information
    deploymentUrl: text('deployment_url'), // Live deployment URL
    cloudflareAccountId: text('cloudflare_account_id'), // Which CF account was used
    deploymentStatus: text('deployment_status').default('none'), // 'none', 'deploying', 'deployed', 'failed'
    deploymentMetadata: text('deployment_metadata', { mode: 'json' }).default('{}'),
    
    // App Metadata
    isArchived: integer('is_archived', { mode: 'boolean' }).default(false),
    isFeatured: integer('is_featured', { mode: 'boolean' }).default(false), // Featured by admins
    
    // Removed viewCount, forkCount, likeCount - use COUNT() queries with proper indexes instead
    
    // Versioning (for future support)
    version: integer('version').default(1),
    parentAppId: text('parent_app_id'), // If forked from another app
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    lastDeployedAt: integer('last_deployed_at', { mode: 'timestamp' }),
}, (table) => ({
    userIdx: index('apps_user_idx').on(table.userId),
    teamIdx: index('apps_team_idx').on(table.teamId),
    boardIdx: index('apps_board_idx').on(table.boardId),
    statusIdx: index('apps_status_idx').on(table.status),
    visibilityIdx: index('apps_visibility_idx').on(table.visibility),
    slugIdx: index('apps_slug_idx').on(table.slug),
    sessionTokenIdx: index('apps_session_token_idx').on(table.sessionToken),
    parentAppIdx: index('apps_parent_app_idx').on(table.parentAppId),
    // Performance indexes for common queries
    searchIdx: index('apps_search_idx').on(table.title, table.description),
    frameworkStatusIdx: index('apps_framework_status_idx').on(table.framework, table.status),
    visibilityStatusIdx: index('apps_visibility_status_idx').on(table.visibility, table.status),
    createdAtIdx: index('apps_created_at_idx').on(table.createdAt),
    updatedAtIdx: index('apps_updated_at_idx').on(table.updatedAt),
}));

/**
 * CodeGenInstances table - Track active generation sessions with real-time state
 */
export const codeGenInstances = sqliteTable('code_gen_instances', {
    id: text('id').primaryKey(),
    
    // Associated App
    appId: text('app_id').references(() => apps.id, { onDelete: 'cascade' }),
    
    // Session Context
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token'), // For anonymous sessions
    websocketConnectionId: text('websocket_connection_id'), // For real-time updates
    
    // Generation State
    currentPhase: text('current_phase'),
    phases: text('phases', { mode: 'json' }).default('[]'), // Array of completed phases
    isGenerating: integer('is_generating', { mode: 'boolean' }).default(false),
    isPaused: integer('is_paused', { mode: 'boolean' }).default(false),
    
    // Runtime State
    blueprint: text('blueprint', { mode: 'json' }),
    generatedFiles: text('generated_files', { mode: 'json' }).default('{}'),
    runtimeErrors: text('runtime_errors', { mode: 'json' }).default('[]'),
    deploymentInfo: text('deployment_info', { mode: 'json' }).default('{}'),
    
    // Agent Communication
    agentMessages: text('agent_messages', { mode: 'json' }).default('[]'), // Chat history
    commandHistory: text('command_history', { mode: 'json' }).default('[]'),
    
    // Status and Error Handling
    status: text('status').notNull().default('active'), // 'active', 'completed', 'error', 'cancelled'
    errorInfo: text('error_info', { mode: 'json' }),
    
    // Timing
    startedAt: integer('started_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    appIdx: index('codegen_instances_app_idx').on(table.appId),
    userIdx: index('codegen_instances_user_idx').on(table.userId),
    sessionTokenIdx: index('codegen_instances_session_token_idx').on(table.sessionToken),
    statusIdx: index('codegen_instances_status_idx').on(table.status),
    websocketIdx: index('codegen_instances_websocket_idx').on(table.websocketConnectionId),
}));

/**
 * Favorites table - Track user favorite apps
 */
export const favorites = sqliteTable('favorites', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    userAppIdx: uniqueIndex('favorites_user_app_idx').on(table.userId, table.appId),
    userIdx: index('favorites_user_idx').on(table.userId),
    appIdx: index('favorites_app_idx').on(table.appId),
}));

/**
 * Stars table - Track app stars (like GitHub stars)
 */
export const stars = sqliteTable('stars', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    starredAt: integer('starred_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    userAppIdx: uniqueIndex('stars_user_app_idx').on(table.userId, table.appId),
    userIdx: index('stars_user_idx').on(table.userId),
    appIdx: index('stars_app_idx').on(table.appId),
}));

// ========================================
// COMMUNITY INTERACTIONS
// ========================================

/**
 * AppLikes table - User likes/reactions on apps
 */
export const appLikes = sqliteTable('app_likes', {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Reaction Details
    reactionType: text('reaction_type').notNull().default('like'), // 'like', 'love', 'helpful', etc.
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    appUserIdx: uniqueIndex('app_likes_app_user_idx').on(table.appId, table.userId),
    userIdx: index('app_likes_user_idx').on(table.userId),
}));

/**
 * CommentLikes table - User likes on comments
 */
export const commentLikes = sqliteTable('comment_likes', {
    id: text('id').primaryKey(),
    commentId: text('comment_id').notNull().references(() => appComments.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Reaction Details
    reactionType: text('reaction_type').notNull().default('like'), // 'like', 'love', 'helpful', etc.
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    commentUserIdx: uniqueIndex('comment_likes_comment_user_idx').on(table.commentId, table.userId),
    userIdx: index('comment_likes_user_idx').on(table.userId),
    commentIdx: index('comment_likes_comment_idx').on(table.commentId),
}));

/**
 * AppComments table - Comments and discussions on apps
 */
export const appComments = sqliteTable('app_comments', {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Comment Content
    content: text('content').notNull(),
    parentCommentId: text('parent_comment_id'), // For threaded comments
    
    // Moderation
    isEdited: integer('is_edited', { mode: 'boolean' }).default(false),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),
    
    // Removed likeCount and replyCount - use COUNT() queries with proper indexes instead
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    appIdx: index('app_comments_app_idx').on(table.appId),
    userIdx: index('app_comments_user_idx').on(table.userId),
    parentIdx: index('app_comments_parent_idx').on(table.parentCommentId),
}));

// ========================================
// ANALYTICS AND TRACKING
// ========================================

/**
 * AppViews table - Track app views for analytics
 */
export const appViews = sqliteTable('app_views', {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    
    // Viewer Information
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // Null for anonymous
    sessionToken: text('session_token'), // For anonymous tracking
    ipAddressHash: text('ip_address_hash'), // Hashed IP for privacy
    
    // View Context
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    deviceType: text('device_type'), // 'desktop', 'mobile', 'tablet'
    
    // Timing
    viewedAt: integer('viewed_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    durationSeconds: integer('duration_seconds'), // How long they viewed
}, (table) => ({
    appIdx: index('app_views_app_idx').on(table.appId),
    userIdx: index('app_views_user_idx').on(table.userId),
    viewedAtIdx: index('app_views_viewed_at_idx').on(table.viewedAt),
}));

// ========================================
// OAUTH AND EXTERNAL INTEGRATIONS
// ========================================

/**
 * OAuthStates table - Manage OAuth flow states securely
 */
export const oauthStates = sqliteTable('oauth_states', {
    id: text('id').primaryKey(),
    state: text('state').notNull().unique(), // OAuth state parameter
    provider: text('provider').notNull(), // 'github', 'google', etc.
    
    // Flow Context
    redirectUri: text('redirect_uri'),
    scopes: text('scopes', { mode: 'json' }).default('[]'),
    userId: text('user_id').references(() => users.id), // If linking to existing account
    
    // Security
    codeVerifier: text('code_verifier'), // For PKCE
    nonce: text('nonce'),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    isUsed: integer('is_used', { mode: 'boolean' }).default(false),
}, (table) => ({
    stateIdx: uniqueIndex('oauth_states_state_idx').on(table.state),
    expiresAtIdx: index('oauth_states_expires_at_idx').on(table.expiresAt),
}));

// ========================================
// NORMALIZED RELATIONSHIPS
// ========================================

/**
 * AppTags table - Normalized tags for apps
 */
export const appTags = sqliteTable('app_tags', {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    tagName: text('tag_name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    appTagIdx: uniqueIndex('app_tags_app_tag_idx').on(table.appId, table.tagName),
    tagNameIdx: index('app_tags_tag_name_idx').on(table.tagName),
}));

/**
 * AppCategories table - Normalized categories for apps
 */
export const appCategories = sqliteTable('app_categories', {
    id: text('id').primaryKey(),
    appId: text('app_id').notNull().references(() => apps.id, { onDelete: 'cascade' }),
    categoryName: text('category_name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    appCategoryIdx: uniqueIndex('app_categories_app_category_idx').on(table.appId, table.categoryName),
    categoryNameIdx: index('app_categories_category_name_idx').on(table.categoryName),
}));

/**
 * Auth Attempts table - Security monitoring and rate limiting
 */
export const authAttempts = sqliteTable('auth_attempts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    identifier: text('identifier').notNull(),
    attemptType: text('attempt_type', { 
        enum: ['login', 'register', 'oauth_google', 'oauth_github', 'refresh', 'reset_password'] 
    }).notNull(),
    success: integer('success', { mode: 'boolean' }).notNull(),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent'),
    attemptedAt: integer('attempted_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    lookupIdx: index('auth_attempts_lookup_idx').on(table.identifier, table.attemptedAt),
    ipIdx: index('auth_attempts_ip_idx').on(table.ipAddress, table.attemptedAt),
    successIdx: index('auth_attempts_success_idx').on(table.success, table.attemptedAt),
    attemptTypeIdx: index('auth_attempts_type_idx').on(table.attemptType, table.attemptedAt),
}));

/**
 * Password Reset Tokens table - Secure password reset functionality
 */
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    used: integer('used', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    lookupIdx: index('password_reset_tokens_lookup_idx').on(table.tokenHash),
    expiryIdx: index('password_reset_tokens_expiry_idx').on(table.expiresAt),
}));

/**
 * Email Verification Tokens table - Email verification functionality
 */
export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    email: text('email').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    used: integer('used', { mode: 'boolean' }).default(false),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    lookupIdx: index('email_verification_tokens_lookup_idx').on(table.tokenHash),
    expiryIdx: index('email_verification_tokens_expiry_idx').on(table.expiresAt),
}));

/**
 * AuditLogs table - Track important changes for compliance
 */
export const auditLogs = sqliteTable('audit_logs', {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    oldValues: text('old_values', { mode: 'json' }),
    newValues: text('new_values', { mode: 'json' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    userIdx: index('audit_logs_user_idx').on(table.userId),
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));

// ========================================
// USER SECRETS AND API KEYS
// ========================================

/**
 * User Secrets table - Stores encrypted API keys and secrets for code generation
 * Used by code generator to access external services (Stripe, OpenAI, Cloudflare, etc.)
 */
export const userSecrets = sqliteTable('user_secrets', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    
    // Secret identification
    name: text('name').notNull(), // User-friendly name (e.g., "My Stripe API Key")
    provider: text('provider').notNull(), // Service provider (stripe, openai, cloudflare, etc.)
    secretType: text('secret_type').notNull(), // api_key, account_id, secret_key, token, etc.
    
    // Encrypted secret data
    encryptedValue: text('encrypted_value').notNull(), // AES-256 encrypted secret
    keyPreview: text('key_preview').notNull(), // First/last few chars for identification
    
    // Configuration and metadata
    environment: text('environment').default('production'), // production, sandbox, test
    description: text('description'), // Optional user description
    expiresAt: integer('expires_at', { mode: 'timestamp' }), // Optional expiration
    
    // Usage tracking
    lastUsed: integer('last_used', { mode: 'timestamp' }),
    usageCount: integer('usage_count').default(0),
    
    // Status and security
    isActive: integer('is_active', { mode: 'boolean' }).default(true),
    
    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    userIdx: index('user_secrets_user_idx').on(table.userId),
    providerIdx: index('user_secrets_provider_idx').on(table.provider),
    userProviderIdx: index('user_secrets_user_provider_idx').on(table.userId, table.provider, table.secretType),
    activeIdx: index('user_secrets_active_idx').on(table.isActive),
}));

// ========================================
// SYSTEM CONFIGURATION
// ========================================

/**
 * SystemSettings table - Global system configuration
 */
export const systemSettings = sqliteTable('system_settings', {
    id: text('id').primaryKey(),
    key: text('key').notNull().unique(),
    value: text('value', { mode: 'json' }),
    description: text('description'),
    
    // Metadata
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
    updatedBy: text('updated_by').references(() => users.id),
}, (table) => ({
    keyIdx: uniqueIndex('system_settings_key_idx').on(table.key),
}));

// ========================================
// TYPE EXPORTS FOR APPLICATION USE
// ========================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;

export type CodeGenInstance = typeof codeGenInstances.$inferSelect;
export type NewCodeGenInstance = typeof codeGenInstances.$inferInsert;

export type Board = typeof boards.$inferSelect;
export type NewBoard = typeof boards.$inferInsert;

export type BoardMember = typeof boardMembers.$inferSelect;
export type NewBoardMember = typeof boardMembers.$inferInsert;

export type CloudflareAccount = typeof cloudflareAccounts.$inferSelect;
export type NewCloudflareAccount = typeof cloudflareAccounts.$inferInsert;

export type GitHubIntegration = typeof githubIntegrations.$inferSelect;
export type NewGitHubIntegration = typeof githubIntegrations.$inferInsert;

export type AppLike = typeof appLikes.$inferSelect;
export type NewAppLike = typeof appLikes.$inferInsert;

export type CommentLike = typeof commentLikes.$inferSelect;
export type NewCommentLike = typeof commentLikes.$inferInsert;

export type AppComment = typeof appComments.$inferSelect;
export type NewAppComment = typeof appComments.$inferInsert;

export type AppView = typeof appViews.$inferSelect;
export type NewAppView = typeof appViews.$inferInsert;

export type OAuthState = typeof oauthStates.$inferSelect;
export type NewOAuthState = typeof oauthStates.$inferInsert;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

export type AppTag = typeof appTags.$inferSelect;
export type NewAppTag = typeof appTags.$inferInsert;

export type AppCategory = typeof appCategories.$inferSelect;
export type NewAppCategory = typeof appCategories.$inferInsert;

export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;

export type AuthAttempt = typeof authAttempts.$inferSelect;
export type NewAuthAttempt = typeof authAttempts.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type UserSecret = typeof userSecrets.$inferSelect;
export type NewUserSecret = typeof userSecrets.$inferInsert;
