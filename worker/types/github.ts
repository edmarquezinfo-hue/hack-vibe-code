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
