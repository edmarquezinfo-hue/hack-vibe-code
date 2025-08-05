/**
 * GitHub integration types for exporting generated applications
 */

export interface GitHubExportOptions {
    repositoryName: string;
    isPrivate: boolean;
    description?: string;
    userId?: string;
}

export interface GitHubExportResult {
    success: boolean;
    repositoryUrl?: string;
    error?: string;
}

export interface GitHubInitRequest {
    token: string;
    repositoryName: string;
    description?: string;
    isPrivate: boolean;
    email: string;
    username: string;
}

export interface GitHubInitResponse {
    success: boolean;
    repositoryUrl?: string;
    error?: string;
    cloneUrl?: string;
}

export interface GitHubPushRequest {
    commitMessage: string;
}

export interface GitHubPushResponse {
    success: boolean;
    error?: string;
    commitSha?: string;
}