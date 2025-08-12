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
import { parse, modify, applyEdits } from 'jsonc-parser';
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
  CLOUDFLARE_AI_GATEWAY?: string;
  CLOUDFLARE_AI_GATEWAY_URL?: string;
  CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
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
  private aiGatewayCloudflare?: Cloudflare; // Separate SDK instance for AI Gateway operations

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
      'TEMPLATES_REPOSITORY'
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
      CLOUDFLARE_AI_GATEWAY: process.env.CLOUDFLARE_AI_GATEWAY,
      CLOUDFLARE_AI_GATEWAY_URL: process.env.CLOUDFLARE_AI_GATEWAY_URL,
      CLOUDFLARE_AI_GATEWAY_TOKEN: process.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
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
   * Creates or ensures AI Gateway exists (non-blocking)
   */
  private async ensureAIGateway(): Promise<void> {
    if (!this.env.CLOUDFLARE_AI_GATEWAY) {
      console.log('ℹ️  AI Gateway setup skipped (CLOUDFLARE_AI_GATEWAY not provided)');
      return;
    }

    const gatewayName = this.env.CLOUDFLARE_AI_GATEWAY;
    console.log(`🔍 Checking AI Gateway: ${gatewayName}`);

    try {
      // Step 1: Check main token permissions and create AI Gateway token if needed
      console.log('🔍 Checking API token permissions...');
      const tokenCheck = await this.checkTokenPermissions();
      const aiGatewayToken = await this.ensureAIGatewayToken();

      // Step 2: Check if gateway exists first using appropriate SDK
      const aiGatewaySDK = this.getAIGatewaySDK();
      
      try {
        await aiGatewaySDK.aiGateway.get(
          gatewayName,
          { account_id: this.env.CLOUDFLARE_ACCOUNT_ID }
        );
        console.log(`✅ AI Gateway '${gatewayName}' already exists`);
        return;
      } catch (error: any) {
        // If error is not 404, log but continue
        if (error?.status !== 404 && !error?.message?.includes('not found')) {
          console.warn(`⚠️  Could not check AI Gateway '${gatewayName}': ${error.message}`);
          return;
        }
        // Gateway doesn't exist, continue to create it
      }

      // Validate gateway name length (64 character limit)
      if (gatewayName.length > 64) {
        console.warn(`⚠️  AI Gateway name too long (${gatewayName.length} > 64 chars), skipping creation`);
        return;
      }
      
      // Step 3: Create AI Gateway with authentication based on token availability
      console.log(`📦 Creating AI Gateway: ${gatewayName}`);
      
      await aiGatewaySDK.aiGateway.create({
        account_id: this.env.CLOUDFLARE_ACCOUNT_ID,
        id: gatewayName,
        cache_invalidate_on_update: true,
        cache_ttl: 3600,
        collect_logs: true,
        rate_limiting_interval: 0,
        rate_limiting_limit: 0,
        rate_limiting_technique: 'sliding',
        authentication: !!aiGatewayToken, // Enable authentication only if we have a token
      });

      console.log(`✅ Successfully created AI Gateway: ${gatewayName} (authentication: ${aiGatewayToken ? 'enabled' : 'disabled'})`);
      
    } catch (error) {
      // Non-blocking: Log warning but continue deployment
      console.warn(`⚠️  Could not create AI Gateway '${gatewayName}': ${error instanceof Error ? error.message : String(error)}`);
      console.warn('   Continuing deployment without AI Gateway setup...');
    }
  }

  /**
   * Verifies if the current API token has AI Gateway permissions
   */
  private async checkTokenPermissions(): Promise<{ hasAIGatewayAccess: boolean; tokenInfo?: any }> {
    try {
      const verifyResponse = await fetch(
        'https://api.cloudflare.com/client/v4/user/tokens/verify',
        {
          headers: {
            'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`
          }
        }
      );

      if (!verifyResponse.ok) {
        console.warn('⚠️  Could not verify API token permissions');
        return { hasAIGatewayAccess: false };
      }

      const verifyData = await verifyResponse.json();
      if (!verifyData.success) {
        console.warn('⚠️  API token verification failed');
        return { hasAIGatewayAccess: false };
      }

      // For now, assume we need to create a separate token for AI Gateway operations
      // This is a conservative approach since permission checking is complex
      console.log('ℹ️  Main API token verified, but will create dedicated AI Gateway token');
      return { hasAIGatewayAccess: false, tokenInfo: verifyData.result };
      
    } catch (error) {
      console.warn(`⚠️  Token verification failed: ${error instanceof Error ? error.message : String(error)}`);
      return { hasAIGatewayAccess: false };
    }
  }

  /**
   * Creates AI Gateway authentication token if needed (non-blocking)
   * Returns the token if created/available, null otherwise
   */
  private async ensureAIGatewayToken(): Promise<string | null> {
    const currentToken = this.env.CLOUDFLARE_AI_GATEWAY_TOKEN;
    
    // Check if token is already set and not the default placeholder
    if (currentToken && currentToken !== 'optional-your-cf-ai-gateway-token') {
      console.log('✅ AI Gateway token already configured');
      // Initialize separate AI Gateway SDK instance
      this.aiGatewayCloudflare = new Cloudflare({ apiToken: currentToken });
      return currentToken;
    }

    try {
      console.log(`🔐 Creating AI Gateway authentication token...`);
      
      // Create API token with required permissions for AI Gateway including RUN
      const tokenResponse = await fetch(
        `https://api.cloudflare.com/client/v4/user/tokens`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `AI Gateway Token - ${new Date().toISOString().split('T')[0]}`,
            policies: [
              {
                effect: 'allow',
                resources: {
                  [`com.cloudflare.api.account.${this.env.CLOUDFLARE_ACCOUNT_ID}`]: '*'
                },
                permission_groups: [
                  // Note: Using descriptive names, actual IDs would need to be fetched from the API
                  { name: 'AI Gateway Read' },
                  { name: 'AI Gateway Edit' },
                  { name: 'AI Gateway Run' }, // This is the key permission for authentication
                  { name: 'Workers AI Read' },
                  { name: 'Workers AI Edit' }
                ]
              }
            ],
            condition: {
              request_ip: { in: [], not_in: [] }
            },
            expires_on: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
          })
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({ errors: [{ message: 'Unknown error' }] }));
        throw new Error(`API token creation failed: ${errorData.errors?.[0]?.message || tokenResponse.statusText}`);
      }

      const tokenData = await tokenResponse.json();
      
      if (tokenData.success && tokenData.result?.value) {
        const newToken = tokenData.result.value;
        console.log('✅ AI Gateway authentication token created successfully');
        console.log(`   Token ID: ${tokenData.result.id}`);
        console.warn('⚠️  Please save this token and add it to CLOUDFLARE_AI_GATEWAY_TOKEN:');
        console.warn(`   ${newToken}`);
        
        // Initialize separate AI Gateway SDK instance
        this.aiGatewayCloudflare = new Cloudflare({ apiToken: newToken });
        return newToken;
      } else {
        throw new Error('Token creation succeeded but no token value returned');
      }
      
    } catch (error) {
      // Non-blocking: Log warning but continue
      console.warn(`⚠️  Could not create AI Gateway token: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('   AI Gateway will be created without authentication...');
      return null;
    }
  }

  /**
   * Gets the appropriate Cloudflare SDK instance for AI Gateway operations
   */
  private getAIGatewaySDK(): Cloudflare {
    return this.aiGatewayCloudflare || this.cloudflare;
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
      
      // Parse the JSONC file to validate structure and find container index
      const config = parse(content) as WranglerConfig;
      
      if (!config.containers || !Array.isArray(config.containers)) {
        console.warn('⚠️  No containers configuration found in wrangler.jsonc');
        return;
      }

      // Find the index of UserAppSandboxService container
      const sandboxContainerIndex = config.containers.findIndex(
        container => container.class_name === 'UserAppSandboxService'
      );

      if (sandboxContainerIndex === -1) {
        console.warn('⚠️  UserAppSandboxService container not found in wrangler.jsonc');
        return;
      }

      const oldMaxInstances = config.containers[sandboxContainerIndex].max_instances;
      
      // Use jsonc-parser's modify function to properly edit the file
      // Path to the max_instances field: ['containers', index, 'max_instances']
      const edits = modify(
        content,
        ['containers', sandboxContainerIndex, 'max_instances'],
        maxInstancesNum,
        {
        //   keepComments: true,
        //   keepSpace: true,
        //   insertSpaces: true,
        //   tabSize: 2
        }
      );

      // Apply the edits to get the updated content
      const updatedContent = applyEdits(content, edits);

      // Write back the updated configuration
      writeFileSync(wranglerPath, updatedContent, 'utf-8');
      
      console.log(`✅ Updated UserAppSandboxService max_instances: ${oldMaxInstances} → ${maxInstancesNum}`);
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
   * Deploys the project using Wrangler
   */
  private async wranglerDeploy(): Promise<void> {
    console.log('🚀 Deploying to Cloudflare Workers...');
    
    try {
      execSync('wrangler deploy', {
        stdio: 'inherit',
        cwd: PROJECT_ROOT
      });
      
      console.log('✅ Wrangler deployment completed');
    } catch (error) {
      throw new DeploymentError(
        'Failed to deploy with Wrangler',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Creates .prod.vars file with current environment variables
   */
  private createProdVarsFile(): void {
    const prodVarsPath = join(PROJECT_ROOT, '.prod.vars');
    
    console.log('📝 Creating .prod.vars file from environment variables...');
    
    // Map of environment variables to include in production secrets
    const secretVars = [
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'TEMPLATES_REPOSITORY',
      'CLOUDFLARE_AI_GATEWAY',
      'CLOUDFLARE_AI_GATEWAY_URL',
      'CLOUDFLARE_AI_GATEWAY_TOKEN',
      'ANTHROPIC_API_KEY',
      'OPENAI_API_KEY',
      'GEMINI_API_KEY',
      'OPENROUTER_API_KEY',
      'GROQ_API_KEY',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_CLIENT_ID',
      'GITHUB_CLIENT_ID',
      'GITHUB_CLIENT_SECRET',
      'JWT_SECRET',
      'WEBHOOK_SECRET',
      'MAX_SANDBOX_INSTANCES'
    ];
    
    const prodVarsContent: string[] = [
      '# Production environment variables for Cloudflare Orange Build',
      '# Generated automatically during deployment',
      '',
      '# Essential Secrets:',
    ];
    
    // Add environment variables that are set
    secretVars.forEach(varName => {
      const value = process.env[varName];
      if (value && value !== '') {
        // Skip placeholder values
        if (value.startsWith('optional-') || value.startsWith('your-')) {
          prodVarsContent.push(`# ${varName}="${value}" # Placeholder - update with actual value`);
        } else {
          prodVarsContent.push(`${varName}="${value}"`);
        }
      } else {
        prodVarsContent.push(`# ${varName}="" # Not set in current environment`);
      }
    });
    
    // Add environment marker
    prodVarsContent.push('');
    prodVarsContent.push('ENVIRONMENT="production"');
    
    try {
      writeFileSync(prodVarsPath, prodVarsContent.join('\n') + '\n', 'utf-8');
      console.log(`✅ Created .prod.vars file with ${secretVars.length} environment variables`);
    } catch (error) {
      console.warn(`⚠️  Could not create .prod.vars file: ${error instanceof Error ? error.message : String(error)}`);
      throw new DeploymentError(
        'Failed to create .prod.vars file',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Updates secrets using Wrangler (non-blocking)
   */
  private async updateSecrets(): Promise<void> {
    console.log('🔐 Updating production secrets...');
    
    try {
      const prodVarsPath = join(PROJECT_ROOT, '.prod.vars');
      
      // Check if .prod.vars file exists, create it if not
      if (!existsSync(prodVarsPath)) {
        console.log('📋 .prod.vars file not found, creating from environment variables...');
        this.createProdVarsFile();
      }

      // Verify file exists after creation attempt
      if (!existsSync(prodVarsPath)) {
        console.warn('⚠️  Could not create .prod.vars file, skipping secret update');
        return;
      }

      execSync('wrangler secret bulk .prod.vars', {
        stdio: 'inherit',
        cwd: PROJECT_ROOT
      });
      
      console.log('✅ Production secrets updated successfully');
    } catch (error) {
      // Non-blocking: Log warning but don't fail deployment
      console.warn(`⚠️  Could not update secrets: ${error instanceof Error ? error.message : String(error)}`);
      console.warn('   You may need to update secrets manually if required');
    }
  }

  /**
   * Main deployment orchestration method
   */
  public async deploy(): Promise<void> {
    console.log('🧡 Cloudflare Orange Build - Automated Deployment Starting...\n');
    
    const startTime = Date.now();
    
    try {
      // Steps 1-5: Run all setup operations in parallel
    //   const operations: Promise<void>[] = [
    //     this.ensureDispatchNamespace(),
    //     this.deployTemplates(),
    //     this.buildProject(),
    //   ];
      
    //   // Add AI Gateway setup if gateway name is provided
    //   if (this.env.CLOUDFLARE_AI_GATEWAY) {
    //     operations.push(this.ensureAIGateway());
    //     console.log('📋 Steps 1-5: Running all setup operations in parallel...');
    //     console.log('   🔄 Workers for Platforms namespace setup');
    //     console.log('   🔄 Templates repository deployment');
    //     console.log('   🔄 Project build (clean + compile)');
    //     console.log('   🔄 Database migrations (generate + apply)');
    //     console.log('   🔄 AI Gateway setup and configuration');
    //   } else {
    //     console.log('📋 Steps 1-4: Running all setup operations in parallel...');
    //     console.log('   🔄 Workers for Platforms namespace setup');
    //     console.log('   🔄 Templates repository deployment');
    //     console.log('   🔄 Project build (clean + compile)');
    //     console.log('   🔄 Database migrations (generate + apply)');
    //   }
      
    //   await Promise.all(operations);
      
    //   console.log('✅ Parallel setup, build, and database migrations completed!');
      
      // Step 6: Update container configuration if needed
      console.log('\n📋 Step 6: Updating container configuration...');
      this.updateContainerConfiguration();
      
    //   // Step 7: Deploy with Wrangler
      console.log('\n📋 Step 7: Deploying to Cloudflare Workers...');
      await this.wranglerDeploy();
      
      // Step 8: Update secrets (non-blocking)
      console.log('\n📋 Step 8: Updating production secrets...');
      await this.updateSecrets();
      
      // Deployment complete
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n🎉 Complete deployment finished successfully in ${duration}s!`);
      console.log('✅ Your Cloudflare Orange Build platform is now live! 🚀');
      
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