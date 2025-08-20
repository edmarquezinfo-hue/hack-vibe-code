/**
 * Type definitions for AppView Controller responses
 * Following strict DRY principles by reusing existing database types
 */

import { EnhancedAppData } from '../../../database/types';

/**
 * Generated code file structure
 */
export interface GeneratedCodeFile {
    filePath: string;
    fileContents: string;
    explanation?: string;
}

/**
 * Response data for getAppDetails - extends existing EnhancedAppData
 * Adds only fields unique to app view response, uses EnhancedAppData stats directly
 */
export interface AppDetailsData extends EnhancedAppData {
    cloudflareUrl: string | null;
    previewUrl: string | null;
    user: {
        id: string;
        displayName: string;
        avatarUrl: string | null;
    };
    generatedCode: GeneratedCodeFile[];
}

/**
 * Response data for toggleAppStar
 */
export interface AppStarToggleData {
    isStarred: boolean;
    starCount: number;
}

/**
 * Response data for forkApp
 */
export interface ForkAppData {
    forkedAppId: string;
    message: string;
}