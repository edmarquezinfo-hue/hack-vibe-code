/**
 * Authentication Type Definitions
 */

import type { ApiKey, AuthAttempt as SchemaAuthAttempt, AuditLog, OAuthState } from '../database/schema';

/**
 * OAuth provider types
 */
export type OAuthProvider = 'google' | 'github';

/**
 * Authenticated user for middleware and session context
 */
export interface AuthUser {
	id: string;
	email: string;
	displayName?: string;
	username?: string;
	avatarUrl?: string;
}

/**
 * Session information for active authentication
 */
export interface AuthSession {
	userId: string;
	email: string;
	sessionId: string;
	expiresAt: Date | null;
};

/**
 * Token payload structure for JWT tokens
 */
export interface TokenPayload {
	// Standard JWT claims
	sub: string; // User ID
	iat: number; // Issued at
	exp: number; // Expires at

	// Custom claims
	email: string;
	type: 'access' | 'refresh';
	jti?: string; // JWT ID (for refresh tokens)

	// Session context
	sessionId?: string;

	// Security metadata
	ipHash?: string; // Hashed IP for security validation
}

/**
 * Authentication result from login/register operations
 */
export interface AuthResult {
	user: AuthUser;
	accessToken: string;
	refreshToken: string;
	expiresIn: number;
	sessionId?: string;
	isNewUser?: boolean;
	requiresEmailVerification?: boolean;
};

/**
 * OAuth provider user information
 */
export interface OAuthUserInfo {
	id: string;
	email: string;
	name?: string;
	picture?: string;
	emailVerified?: boolean;
	locale?: string;

	// Provider-specific data
	providerData?: Record<string, unknown>;
}

/**
 * OAuth tokens from provider
 */
export interface OAuthTokens {
	accessToken: string;
	refreshToken?: string;
	idToken?: string;
	tokenType: string;
	expiresIn?: number;
	scope?: string;
}

/**
 * OAuth state for secure authentication flow
 * Uses OAuthState schema with typed provider
 */
export type OAuthStateData = Omit<OAuthState, 'provider'> & {
	provider: OAuthProvider;
};

/**
 * API Key info for client display
 * Subset of ApiKey schema without sensitive data
 */
export type ApiKeyInfo = Pick<ApiKey, 'id' | 'name' | 'keyPreview' | 'createdAt' | 'lastUsed' | 'isActive'>;

/**
 * Re-export AuthAttempt from schema
 */
export type { SchemaAuthAttempt as AuthAttempt };

/**
 * Password validation result with strength scoring
 */
export interface PasswordValidationResult {
	valid: boolean;
	errors?: string[];
	score: number; // 0-4 strength score

	// Detailed validation
	requirements?: {
		minLength: boolean;
		hasLowercase: boolean;
		hasUppercase: boolean;
		hasNumbers: boolean;
		hasSpecialChars: boolean;
		notCommon: boolean;
		noSequential: boolean;
	};

	// Suggestions for improvement
	suggestions?: string[];
}

/**
 * Security context for authentication operations
 */
export interface SecurityContext {
	// Request metadata
	ipAddress: string;
	userAgent: string;
	requestId: string;

	// Geographic and network info
	country?: string;
	region?: string;
	isp?: string;

	// Device fingerprinting
	deviceFingerprint?: string;

	// Risk assessment
	riskScore?: number; // 0-100
	riskFactors?: string[];
}

/**
 * Audit log entry with security context
 */
export type AuditLogEntry = AuditLog & {
	securityContext?: Partial<SecurityContext>;
};

/**
 * Session cleanup configuration and statistics
 */
export interface SessionCleanupConfig {
	// Cleanup intervals
	expiredSessionCleanupInterval: number; // How often to clean expired sessions
	inactiveSessionTimeout: number; // How long before inactive sessions are removed
	maxSessionsPerUser: number; // Maximum concurrent sessions per user

	// Security policies
	forceLogoutOnSuspiciousActivity: boolean;
	sessionHijackingDetection: boolean;

	// Cleanup statistics
	lastCleanupRun?: Date;
	sessionsCleanedUp?: number;
	errorsEncountered?: number;
}

/**
 * User profile update request
 */
export interface UserProfileUpdate {
	displayName?: string | null;
	username?: string | null;
	bio?: string | null;
	avatarUrl?: string | null;
	theme?: 'light' | 'dark' | 'system' | null;
	timezone?: string | null;
	preferences?: string | null;
	newEmail?: string;
	emailChangeToken?: string;
}

/**
 * Password change request with security validation
 */
export interface PasswordChangeRequest {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;

	// Security context
	logoutOtherSessions?: boolean;

	// MFA verification (future)
	mfaToken?: string;
}

/**
 * Account recovery request
 */
export interface AccountRecoveryRequest {
	email: string;

	// Recovery method
	method: 'email' | 'sms' | 'backup_codes';

	// Context for security
	userAgent?: string;
	ipAddress?: string;

	// Rate limiting
	requestedAt: Date;
	expiresAt: Date;

	// Security verification
	verificationCode?: string;
	isUsed: boolean;
}
