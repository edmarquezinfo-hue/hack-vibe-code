
import type { RuntimeError, StaticAnalysisResponse } from '../../services/sandbox/sandboxTypes';
import type { ClientReportedErrorType } from '../schemas';

export interface AllIssues {
    runtimeErrors: RuntimeError[];
    staticAnalysis: StaticAnalysisResponse;
    clientErrors: ClientReportedErrorType[];
}

/**
 * Agent state definition for code generation
 */
export interface ScreenshotData {
    url: string;
    timestamp: number;
    viewport: { width: number; height: number };
    userAgent: string;
    screenshot: string;
}