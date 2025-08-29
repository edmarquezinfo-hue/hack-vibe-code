import { StructuredLogger } from '../../logger';
import { DeploymentCredentials, DeploymentResult } from './sandboxTypes';
import { SandboxSdkClient } from './sandboxSdkClient';

/**
 * DEPRECATED: Legacy interface for backward compatibility
 * This service is now a simple wrapper around the secure SandboxSdkClient implementation
 */
export interface CFDeploymentArgs {
    credentials?: DeploymentCredentials;
    instanceId: string;
    base64encodedArchive: string;
    logger: StructuredLogger;
    projectName: string;
    hostname: string;
}

/**
 * DEPRECATED: Legacy deployment function for backward compatibility
 * 
 * This function is now a wrapper that creates a SandboxSdkClient instance
 * and uses the secure API-based deployment instead of the insecure CLI approach.
 * 
 * @deprecated Use SandboxSdkClient.deployToCloudflareWorkers directly instead
 */
export async function deployToCloudflareWorkers(args: CFDeploymentArgs): Promise<DeploymentResult> {
    args.logger.info('[deployToCloudflareWorkers] Using secure API-based deployment (legacy wrapper)');
    
    // Create a SandboxSdkClient instance for the deployment
    // Note: We generate a session ID for the sandbox allocation
    const sessionId = `deploy-session-${args.instanceId}`;
    const sandboxClient = new SandboxSdkClient(sessionId, args.hostname);
    
    // Initialize the sandbox (required before use)
    await sandboxClient.initialize();
    
    // Use the secure deployment method
    return await sandboxClient.deployToCloudflareWorkers(args.instanceId);
}
