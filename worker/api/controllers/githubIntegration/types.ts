/**
 * Type definitions for GitHub Integration Controller responses
 * Following strict DRY principles by reusing existing database types
 */

/**
 * Response data for getIntegrationStatus
 */
export interface GitHubIntegrationStatusData {
    hasIntegration: boolean;
    githubUsername: string | null;
    scopes: string[];
    lastValidated: Date | null;
}

/**
 * Response data for removeIntegration
 */
export interface GitHubIntegrationRemovalData {
    message: string;
}

/**
 * Input interface for GitHub integration data
 * Used for storing integration after OAuth
 */
export interface GitHubIntegrationInput {
    githubUserId: string;
    githubUsername: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
}