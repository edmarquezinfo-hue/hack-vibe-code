import { getSandbox } from '@cloudflare/sandbox';
import { StructuredLogger } from '../../logger';
import { env } from 'cloudflare:workers'
import { DeploymentCredentials, DeploymentResult } from './sandboxTypes';
import { getProtocolForHost } from '../../utils/urls';
import { isDispatcherAvailable } from '../../utils/dispatcherUtils';

export interface CFDeploymentArgs {
    credentials?: DeploymentCredentials;
    instanceId: string;
    base64encodedArchive: string;
    logger: StructuredLogger;
    projectName: string;
    hostname: string;
}

export async function deployToCloudflareWorkers(args: CFDeploymentArgs): Promise<DeploymentResult> {
    const base64Data = args.base64encodedArchive;
    const sandbox = getSandbox(env.DeployerServiceObject, 'deployer');
    await sandbox.writeFile(`${args.instanceId}.zip.b64`, base64Data);
    
    // Convert base64 back to binary zip file
    await sandbox.exec(`base64 -d ${args.instanceId}.zip.b64 > ${args.instanceId}.zip`);
    args.logger.info(`[deployToCloudflareWorkers] Wrote and converted zip file to sandbox: ${args.instanceId}.zip`);

    // Extract zip file
    await sandbox.exec(`unzip -o -q ${args.instanceId}.zip -d .`);
    args.logger.info(`[deployToCloudflareWorkers] Extracted zip file to sandbox: ${args.instanceId}`);
    // Determine deployment command based on dispatcher availability
    const useDispatchNamespace = isDispatcherAvailable(env);
    const deployCmd = useDispatchNamespace 
        ? `CLOUDFLARE_API_TOKEN=${env.CLOUDFLARE_API_TOKEN} CLOUDFLARE_ACCOUNT_ID=${env.CLOUDFLARE_ACCOUNT_ID} bunx wrangler deploy --dispatch-namespace orange-build-default-namespace`
        : `CLOUDFLARE_API_TOKEN=${env.CLOUDFLARE_API_TOKEN} CLOUDFLARE_ACCOUNT_ID=${env.CLOUDFLARE_ACCOUNT_ID} bunx wrangler deploy`;
    
    args.logger.info(`[deployToCloudflareWorkers] Using deployment mode: ${useDispatchNamespace ? 'dispatch-namespace' : 'standard workers.dev'}`);
                
    const startTime = Date.now();
    const deployResult = await sandbox.exec(`cd ${args.instanceId} && ${deployCmd}`);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    args.logger.info(`[deployToCloudflareWorkers] Deployed ${args.instanceId} in ${duration} seconds`, deployResult);
    if (deployResult.exitCode === 0) {
        // Determine deployed URL based on deployment mode
        let deployedUrl: string;
        let deploymentId: string | undefined;

        if (useDispatchNamespace) {
            // For dispatch namespace deployments, use the constructed URL
            deployedUrl = `${getProtocolForHost(args.hostname)}://${args.projectName}.${args.hostname}`;
            deploymentId = `deploy-${args.instanceId}-${Date.now()}`;
            args.logger.info(`[deployToCloudflareWorkers] Using dispatch namespace URL: ${deployedUrl}`);
        } else {
            // For standard deployments, extract URL from wrangler output
            const urlMatch = deployResult.stdout.match(/https:\/\/[^\s]+\.workers\.dev/g);
            if (urlMatch && urlMatch.length > 0) {
                deployedUrl = urlMatch[urlMatch.length - 1]; // Get the last URL found
                args.logger.info(`[deployToCloudflareWorkers] Extracted workers.dev URL: ${deployedUrl}`);
            } else {
                // Fallback: try to construct workers.dev URL if extraction fails
                deployedUrl = `https://${args.projectName}.YOUR-CF-ACCOUNT-NAME.workers.dev`;
                args.logger.warn(`[deployToCloudflareWorkers] Could not extract URL from output, using fallback: ${deployedUrl}`);
            }

            // Extract deployment/version ID if available
            const versionMatch = deployResult.stdout.match(/Current Version ID: ([a-f0-9-]+)/i);
            deploymentId = versionMatch ? versionMatch[1] : `deploy-${args.instanceId}-${Date.now()}`;
        }

        args.logger.info(`[deployToCloudflareWorkers] Successfully deployed instance ${args.instanceId}`, { 
            deployedUrl, 
            deploymentId,
            deploymentMode: useDispatchNamespace ? 'dispatch-namespace' : 'workers.dev'
        });
        
        return {
            success: true,
            message: 'Successfully deployed to Cloudflare Workers',
            deployedUrl,
            deploymentId,
            output: deployResult.stdout
        };
    } else {
        throw new Error(`[deployToCloudflareWorkers] Deployment failed: STDOUT: ${deployResult.stdout} STDERR: ${deployResult.stderr}`);
    }
}
