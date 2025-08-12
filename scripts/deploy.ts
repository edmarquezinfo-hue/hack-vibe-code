#!/usr/bin/env node

/**
 * Cloudflare Orange Build - Automated Deployment Script
 * 
 * This script handles the complete setup and deployment process for the
 * Cloudflare Orange Build platform, including:
 * - Workers for Platforms dispatch namespace creation
 * - Templates repository deployment to R2
 * - Container configuration updates
 * - Environment validation
 * 
 * Used by the "Deploy to Cloudflare" button for one-click deployment.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'jsonc-parser';
import Cloudflare from 'cloudflare';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Types for configuration
interface WranglerConfig {
  name: string;
  dispatch_namespaces?: Array<{
    binding: string;
    namespace: string;
    experimental_remote?: boolean;
  }>;
  r2_buckets?: Array<{
    binding: string;
    bucket_name: string;
    experimental_remote?: boolean;
  }>;
  containers?: Array<{
    class_name: string;
    image: string;
    max_instances: number;
    configuration?: {
      vcpu: number;
      memory_mib: number;
      disk?: {
        size_mb?: number;
        size?: string;
      };
    };
    rollout_step_percentage?: number;
  }>;
}

interface EnvironmentConfig {
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_ACCOUNT_ID: string;
  TEMPLATES_REPOSITORY: string;
  CF_AI_BASE_URL: string;
  CF_AI_API_KEY: string;
  MAX_SANDBOX_INSTANCES?: string;
}

class DeploymentError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DeploymentError';
  }
}

class CloudflareDeploymentManager {
  private config: WranglerConfig;
  private env: EnvironmentConfig;
  private cloudflare: Cloudflare;

  constructor() {
    this.validateEnvironment();
    this.config = this.parseWranglerConfig();
    this.env = this.getEnvironmentVariables();
    this.cloudflare = new Cloudflare({
      apiToken: this.env.CLOUDFLARE_API_TOKEN
    });
  }

  /**
   * Validates that all required environment variables are present
   */
  private validateEnvironment(): void {
    const requiredVars = [
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID', 
      'TEMPLATES_REPOSITORY',
      'CF_AI_BASE_URL',
      'CF_AI_API_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new DeploymentError(
        `Missing required environment variables: ${missingVars.join(', ')}\n` +
        `Please ensure all required secrets are configured in your deployment.`
      );
    }
    console.log('✅ Environment variables validation passed');
  }

  /**
   * Safely parses wrangler.jsonc file, handling comments and JSON-like syntax
   */
  private parseWranglerConfig(): WranglerConfig {
    const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');
    
    if (!existsSync(wranglerPath)) {
      throw new DeploymentError('wrangler.jsonc file not found in project root');
    }

    try {
      const content = readFileSync(wranglerPath, 'utf-8');
      const config = parse(content) as WranglerConfig;
      
      console.log(`✅ Parsed wrangler.jsonc - Project: ${config.name}`);
      return config;
    } catch (error) {
      throw new DeploymentError(
        'Failed to parse wrangler.jsonc file',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Gets and validates environment variables
   */
  private getEnvironmentVariables(): EnvironmentConfig {
    return {
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID!,
      TEMPLATES_REPOSITORY: process.env.TEMPLATES_REPOSITORY!,
      CF_AI_BASE_URL: process.env.CF_AI_BASE_URL!,
      CF_AI_API_KEY: process.env.CF_AI_API_KEY!,
      MAX_SANDBOX_INSTANCES: process.env.MAX_SANDBOX_INSTANCES
    };
  }

  /**
   * Creates or ensures Workers for Platforms dispatch namespace exists
   */
  private async ensureDispatchNamespace(): Promise<void> {
    const dispatchConfig = this.config.dispatch_namespaces?.[0];
    if (!dispatchConfig) {
      throw new DeploymentError('No dispatch namespace configuration found in wrangler.jsonc');
    }

    const namespaceName = dispatchConfig.namespace;
    console.log(`🔍 Checking dispatch namespace: ${namespaceName}`);

    try {
      // Check if namespace exists using Cloudflare SDK
      try {
        await this.cloudflare.workersForPlatforms.dispatch.namespaces.get(
          namespaceName,
          { account_id: this.env.CLOUDFLARE_ACCOUNT_ID }
        );
        console.log(`✅ Dispatch namespace '${namespaceName}' already exists`);
        return;
      } catch (error: any) {
        // If error is not 404, re-throw it
        if (error?.status !== 404 && error?.message?.indexOf('not found') === -1) {
          throw error;
        }
        // Namespace doesn't exist, continue to create it
      }

      console.log(`📦 Creating dispatch namespace: ${namespaceName}`);
      
      await this.cloudflare.workersForPlatforms.dispatch.namespaces.create({
        account_id: this.env.CLOUDFLARE_ACCOUNT_ID,
        name: namespaceName
      });

      console.log(`✅ Successfully created dispatch namespace: ${namespaceName}`);
    } catch (error) {
      throw new DeploymentError(
        `Failed to ensure dispatch namespace: ${namespaceName}`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Clones templates repository and deploys templates to R2
   */
  private async deployTemplates(): Promise<void> {
    const templatesDir = join(PROJECT_ROOT, 'templates');
    const templatesRepo = this.env.TEMPLATES_REPOSITORY;
    
    console.log(`📥 Setting up templates from: ${templatesRepo}`);

    try {
      // Create templates directory if it doesn't exist
      if (!existsSync(templatesDir)) {
        mkdirSync(templatesDir, { recursive: true });
      }

      // Clone repository if not already present
      if (!existsSync(join(templatesDir, '.git'))) {
        console.log(`🔄 Cloning templates repository...`);
        execSync(`git clone "${templatesRepo}" "${templatesDir}"`, {
          stdio: 'pipe',
          cwd: PROJECT_ROOT
        });
        console.log('✅ Templates repository cloned successfully');
      } else {
        console.log('📁 Templates repository already exists, pulling latest changes...');
        try {
          execSync('git pull origin main || git pull origin master', {
            stdio: 'pipe',
            cwd: templatesDir
          });
          console.log('✅ Templates repository updated');
        } catch (pullError) {
          console.warn('⚠️  Could not pull latest changes, continuing with existing templates');
        }
      }

      // Find R2 bucket name from config
      const templatesBucket = this.config.r2_buckets?.find(
        bucket => bucket.binding === 'TEMPLATES_BUCKET'
      );
      
      if (!templatesBucket) {
        throw new Error('TEMPLATES_BUCKET not found in wrangler.jsonc r2_buckets configuration');
      }

      // Check if deploy script exists
      const deployScript = join(templatesDir, 'deploy_templates.sh');
      if (!existsSync(deployScript)) {
        console.warn('⚠️  deploy_templates.sh not found in templates repository, skipping template deployment');
        return;
      }

      // Make script executable
      execSync(`chmod +x "${deployScript}"`, { cwd: templatesDir });

      // Run deployment script with environment variables
      console.log(`🚀 Deploying templates to R2 bucket: ${templatesBucket.bucket_name}`);
      
      const deployEnv = {
        ...process.env,
        CLOUDFLARE_API_TOKEN: this.env.CLOUDFLARE_API_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: this.env.CLOUDFLARE_ACCOUNT_ID,
        BUCKET_NAME: templatesBucket.bucket_name,
        R2_BUCKET_NAME: templatesBucket.bucket_name
      };

      execSync('./deploy_templates.sh', {
        stdio: 'inherit',
        cwd: templatesDir,
        env: deployEnv
      });

      console.log('✅ Templates deployed successfully to R2');
    } catch (error) {
      // Don't fail the entire deployment if templates fail
      console.warn('⚠️  Templates deployment failed, but continuing with main deployment:');
      console.warn(`   ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates container configuration based on MAX_SANDBOX_INSTANCES environment variable
   */
  private updateContainerConfiguration(): void {
    const maxInstances = this.env.MAX_SANDBOX_INSTANCES;
    
    if (!maxInstances) {
      console.log('ℹ️  MAX_SANDBOX_INSTANCES not set, skipping container configuration update');
      return;
    }

    const maxInstancesNum = parseInt(maxInstances, 10);
    if (isNaN(maxInstancesNum) || maxInstancesNum <= 0) {
      console.warn(`⚠️  Invalid MAX_SANDBOX_INSTANCES value: ${maxInstances}, skipping update`);
      return;
    }

    console.log(`🔧 Updating container configuration: MAX_SANDBOX_INSTANCES=${maxInstancesNum}`);

    try {
      const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');
      const content = readFileSync(wranglerPath, 'utf-8');
      
      // Update the UserAppSandboxService max_instances value
      // This regex finds the UserAppSandboxService container and updates its max_instances
      const updatedContent = content.replace(
        /("class_name":\s*"UserAppSandboxService"[\s\S]*?"max_instances":\s*)\d+/,
        `$1${maxInstancesNum}`
      );

      if (updatedContent === content) {
        console.warn('⚠️  Could not find UserAppSandboxService container configuration to update');
        return;
      }

      // Write back the updated configuration
      writeFileSync(wranglerPath, updatedContent, 'utf-8');
      
      console.log(`✅ Updated UserAppSandboxService max_instances to ${maxInstancesNum}`);
    } catch (error) {
      throw new DeploymentError(
        'Failed to update container configuration',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Builds the project (clean dist and run build)
   */
  private async buildProject(): Promise<void> {
    console.log('🔨 Building project...');
    
    try {
      // Clean dist directory and run build
      execSync('rm -rf dist && bun run build', {
        stdio: 'inherit',
        cwd: PROJECT_ROOT
      });
      
      console.log('✅ Project build completed');
    } catch (error) {
      throw new DeploymentError(
        'Failed to build project',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Main deployment orchestration method
   */
  public async deploy(): Promise<void> {
    console.log('🧡 Cloudflare Orange Build - Automated Deployment Starting...\n');
    
    const startTime = Date.now();
    
    try {
      // Steps 1, 2 & 3: Run all setup operations in parallel
      console.log('📋 Steps 1-3: Running all setup operations in parallel...');
      console.log('   🔄 Workers for Platforms namespace setup');
      console.log('   🔄 Templates repository deployment');
      console.log('   🔄 Project build (clean + compile)');
      
      await Promise.all([
        this.ensureDispatchNamespace(),
        this.deployTemplates(),
        this.buildProject()
      ]);
      
      console.log('✅ Parallel setup and build completed!');
      
      // Step 4: Update container configuration if needed
      console.log('\n📋 Step 4: Updating container configuration...');
      this.updateContainerConfiguration();
      
      // Deployment complete
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n🎉 Deployment completed successfully in ${duration}s!`);
      console.log('\nNext steps:');
      console.log('- Run: wrangler deploy');
      console.log('- Your Cloudflare Orange Build platform will be ready! 🚀');
      
    } catch (error) {
      console.error('\n❌ Deployment failed:');
      
      if (error instanceof DeploymentError) {
        console.error(`   ${error.message}`);
        if (error.cause) {
          console.error(`   Caused by: ${error.cause.message}`);
        }
      } else {
        console.error(`   ${error}`);
      }
      
      console.error('\n🔍 Troubleshooting tips:');
      console.error('   - Verify all environment variables are correctly set');
      console.error('   - Check your Cloudflare API token has required permissions');
      console.error('   - Ensure your account has access to Workers for Platforms');
      console.error('   - Verify the templates repository is accessible');
      console.error('   - Check that bun is installed and build script works');
      
      process.exit(1);
    }
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployer = new CloudflareDeploymentManager();
  deployer.deploy().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export default CloudflareDeploymentManager;