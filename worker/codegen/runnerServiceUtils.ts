import {
    TemplateListResponse, TemplateListResponseSchema,
    TemplateDetailsResponse, TemplateDetailsResponseSchema,
    BootstrapRequest, BootstrapResponse, BootstrapResponseSchema,
    WriteFilesRequest, WriteFilesResponse, WriteFilesResponseSchema,
    ExecuteCommandsRequest, ExecuteCommandsResponse, ExecuteCommandsResponseSchema,
    RuntimeErrorResponse, RuntimeErrorResponseSchema,
    FixCodeResponse, FixCodeResponseSchema,
    ShutdownResponse, ShutdownResponseSchema,
    GetInstanceResponse, GetInstanceResponseSchema,
    StaticAnalysisResponse, CodeIssuesResponseSchema
} from './runnerServiceTypes';
import { createLogger } from '../utils/logger';
import { z } from 'zod';

const logger = createLogger('RunnerServiceClient');

/**
 * Client for interacting with the Runner Service API.
 */
export class RunnerServiceClient {
    private static runnerServiceUrl: string;

    static init(runnerServiceUrl: string) {
        RunnerServiceClient.runnerServiceUrl = runnerServiceUrl;
    }

    private static async makeRequest<T extends z.ZodTypeAny>(
        endpoint: string,
        method: 'GET' | 'POST' | 'DELETE',
        schema?: T,
        body?: any
    ): Promise<z.infer<T> | null> {
        const url = `${RunnerServiceClient.runnerServiceUrl}${endpoint}`;
        logger.info(`Making ${method} request to ${url}`);

        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    // Add any necessary authentication headers here
                },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`Runner service request failed: ${response.status} ${response.statusText} - ${errorText}`);
                return null;
            }

            const responseData = await response.json();
            if(!schema) return responseData;
            const validation = schema.safeParse(responseData);

            if (!validation.success) {
                logger.error(`Failed to validate response from ${url}:`, validation.error.errors);
                return null;
            }

            logger.info(`Successfully received and validated response from ${url}`);
            return validation.data;
        } catch (error) {
            logger.error(`Error making request to runner service at ${url}:`, error);
            return null;
        }
    }

    /**
     * List available templates.
     */
    static async listTemplates(): Promise<TemplateListResponse | null> {
        return RunnerServiceClient.makeRequest('/templates', 'GET', TemplateListResponseSchema);
    }

    /**
     * Get details for a specific template.
     */
    static async getTemplateDetails(templateName: string): Promise<TemplateDetailsResponse | null> {
        return RunnerServiceClient.makeRequest(`/templates/${templateName}`, 'GET', TemplateDetailsResponseSchema);
    }

    /**
     * Create a new runner instance.
     */
    static async createInstance(templateName: string): Promise<BootstrapResponse | null> {
        const requestBody: BootstrapRequest = { templateName };
        return RunnerServiceClient.makeRequest('/instances', 'POST', BootstrapResponseSchema, requestBody);
    }

    /**
     * Get details for a specific runner instance.
     */
    static async getInstanceDetails(instanceId: string): Promise<GetInstanceResponse | null> {
        return RunnerServiceClient.makeRequest(`/instances/${instanceId}`, 'GET', GetInstanceResponseSchema);
    }

    /**
     * Write files to a runner instance.
     */
    static async writeFiles(instanceId: string, files: WriteFilesRequest['files']): Promise<WriteFilesResponse | null> {
        const requestBody: WriteFilesRequest = { files };
        return RunnerServiceClient.makeRequest(`/instances/${instanceId}/files`, 'POST', WriteFilesResponseSchema, requestBody);
    }

    /**
     * Execute commands in a runner instance.
     */
    static async executeCommands(instanceId: string, commands: string[], timeout?: number): Promise<ExecuteCommandsResponse | null> {
        const requestBody: ExecuteCommandsRequest = { commands, timeout };
        return RunnerServiceClient.makeRequest(`/instances/${instanceId}/commands`, 'POST', ExecuteCommandsResponseSchema, requestBody);
    }

    /**
     * Get runtime errors from a runner instance.
     */
    static async getInstanceErrors(instanceId: string): Promise<RuntimeErrorResponse | null> {
        return RunnerServiceClient.makeRequest(`/instances/${instanceId}/errors`, 'GET', RuntimeErrorResponseSchema);
    }

    /**
     * Attempt to automatically fix code issues in a runner instance.
     */
    static async fixCode(instanceId: string): Promise<FixCodeResponse | null> {
        return RunnerServiceClient.makeRequest(`/instances/${instanceId}/fix-code`, 'POST', FixCodeResponseSchema);
    }

    /**
     * Perform static code analysis on a runner instance to find potential issues.
     * @param instanceId The ID of the runner instance
     * @param lintFiles Optional comma-separated list of specific files to lint
     */
    static async runStaticAnalysisCode(instanceId: string, lintFiles?: string[]): Promise<StaticAnalysisResponse | null> {
        const queryParams = lintFiles?.length ? `?files=${lintFiles.join(',')}` : '';
        return RunnerServiceClient.makeRequest(`/instances/${instanceId}/analysis${queryParams}`, 'GET', CodeIssuesResponseSchema);
    }

    /**
     * Shutdown a runner instance.
     */
    static async shutdownInstance(instanceId: string): Promise<ShutdownResponse | null> {
        return RunnerServiceClient.makeRequest(`/instances/${instanceId}`, 'DELETE', ShutdownResponseSchema);
    }

    // temp, debug
    static async writeFileLogs(logName: string, log: string) {
        return RunnerServiceClient.makeRequest('/logs', 'POST', undefined, { logName, log });
    }
}
