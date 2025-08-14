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
		instance_type?: {
			vcpu: number;
			memory_mib: number;
			disk_mb?: number;
		} | string;
		rollout_step_percentage?: number;
	}>;
	d1_databases?: Array<{
		binding: string;
		database_name: string;
		database_id: string;
		migrations_dir?: string;
		experimental_remote?: boolean;
	}>;
	routes?: Array<{
		pattern: string;
		custom_domain: boolean;
	}>;
	vars?: {
		TEMPLATES_REPOSITORY?: string;
		CLOUDFLARE_AI_GATEWAY?: string;
		MAX_SANDBOX_INSTANCES?: string;
		CUSTOM_DOMAIN?: string;
		SANDBOX_INSTANCE_TYPE?: string;
		[key: string]: string | undefined;
	};
}

interface EnvironmentConfig {
	CLOUDFLARE_API_TOKEN: string;
	CLOUDFLARE_ACCOUNT_ID: string;
	TEMPLATES_REPOSITORY: string;
	CLOUDFLARE_AI_GATEWAY?: string;
	CLOUDFLARE_AI_GATEWAY_TOKEN?: string;
}

class DeploymentError extends Error {
	constructor(
		message: string,
		public cause?: Error,
	) {
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
		this.extractConfigurationValues();
		this.env = this.getEnvironmentVariables();
		this.cloudflare = new Cloudflare({
			apiToken: this.env.CLOUDFLARE_API_TOKEN,
		});
	}

	/**
	 * Validates that all required build variables are present
	 */
	private validateEnvironment(): void {
		const requiredBuildVars = ['CLOUDFLARE_API_TOKEN'];

		const missingVars = requiredBuildVars.filter(
			(varName) => !process.env[varName],
		);

		if (missingVars.length > 0) {
			throw new DeploymentError(
				`Missing required build variables: ${missingVars.join(', ')}\n` +
					`Please ensure all required build variables are configured in your deployment.`,
			);
		}
		console.log('✅ Build variables validation passed');
	}


	/**
	 * Extracts and validates key configuration values from wrangler.jsonc
	 */
	private extractConfigurationValues(): void {
		console.log(
			'📋 Extracting configuration values from wrangler.jsonc...',
		);

		// Log key extracted values
		const databaseName = this.config.d1_databases?.[0]?.database_name;
		const customDomain = this.config.vars?.CUSTOM_DOMAIN;
		const maxInstances = this.config.vars?.MAX_SANDBOX_INSTANCES;
		const templatesRepo = this.config.vars?.TEMPLATES_REPOSITORY;
		const aiGateway = this.config.vars?.CLOUDFLARE_AI_GATEWAY;

		console.log('📊 Configuration Summary:');
		console.log(`   Database Name: ${databaseName || 'Not configured'}`);
		console.log(`   Custom Domain: ${customDomain || 'Not configured'}`);
		console.log(
			`   Max Sandbox Instances: ${maxInstances || 'Not configured'}`,
		);
		console.log(
			`   Templates Repository: ${templatesRepo || 'Not configured'}`,
		);
		console.log(`   AI Gateway: ${aiGateway || 'Not configured'}`);

		// Validate critical configuration
		if (!databaseName) {
			console.warn(
				'⚠️  No D1 database configured - database operations may fail',
			);
		}

		if (!customDomain) {
			console.warn(
				'⚠️  No custom domain configured - using default routes',
			);
		}

		console.log('✅ Configuration extraction completed');
	}

	/**
	 * Safely parses wrangler.jsonc file, handling comments and JSON-like syntax
	 */
	private parseWranglerConfig(): WranglerConfig {
		const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');

		if (!existsSync(wranglerPath)) {
			throw new DeploymentError(
				'wrangler.jsonc file not found in project root',
			);
		}

		try {
			const content = readFileSync(wranglerPath, 'utf-8');
			const config = parse(content) as WranglerConfig;

			console.log(`✅ Parsed wrangler.jsonc - Project: ${config.name}`);
			return config;
		} catch (error) {
			throw new DeploymentError(
				'Failed to parse wrangler.jsonc file',
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	/**
	 * Gets and validates environment variables, with defaults from wrangler.jsonc
	 */
	private getEnvironmentVariables(): EnvironmentConfig {
		return {
			CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN!,
			CLOUDFLARE_ACCOUNT_ID:
				process.env.CLOUDFLARE_ACCOUNT_ID ||
				this.config.vars?.CLOUDFLARE_ACCOUNT_ID!,
			TEMPLATES_REPOSITORY:
				process.env.TEMPLATES_REPOSITORY ||
				this.config.vars?.TEMPLATES_REPOSITORY!,
			CLOUDFLARE_AI_GATEWAY:
				process.env.CLOUDFLARE_AI_GATEWAY ||
				this.config.vars?.CLOUDFLARE_AI_GATEWAY,
			CLOUDFLARE_AI_GATEWAY_TOKEN:
				process.env.CLOUDFLARE_AI_GATEWAY_TOKEN,
		};
	}

	/**
	 * Creates or ensures Workers for Platforms dispatch namespace exists
	 */
	private async ensureDispatchNamespace(): Promise<void> {
		const dispatchConfig = this.config.dispatch_namespaces?.[0];
		if (!dispatchConfig) {
			throw new DeploymentError(
				'No dispatch namespace configuration found in wrangler.jsonc',
			);
		}

		const namespaceName = dispatchConfig.namespace;
		console.log(`🔍 Checking dispatch namespace: ${namespaceName}`);

		try {
			// Check if namespace exists using Cloudflare SDK
			try {
				await this.cloudflare.workersForPlatforms.dispatch.namespaces.get(
					namespaceName,
					{ account_id: this.env.CLOUDFLARE_ACCOUNT_ID },
				);
				console.log(
					`✅ Dispatch namespace '${namespaceName}' already exists`,
				);
				return;
			} catch (error: any) {
				// If error is not 404, re-throw it
				if (
					error?.status !== 404 &&
					error?.message?.indexOf('not found') === -1
				) {
					throw error;
				}
				// Namespace doesn't exist, continue to create it
			}

			console.log(`📦 Creating dispatch namespace: ${namespaceName}`);

			await this.cloudflare.workersForPlatforms.dispatch.namespaces.create(
				{
					account_id: this.env.CLOUDFLARE_ACCOUNT_ID,
					name: namespaceName,
				},
			);

			console.log(
				`✅ Successfully created dispatch namespace: ${namespaceName}`,
			);
		} catch (error) {
			throw new DeploymentError(
				`Failed to ensure dispatch namespace: ${namespaceName}`,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	/**
	 * Creates or ensures AI Gateway exists (non-blocking)
	 */
	private async ensureAIGateway(): Promise<void> {
		if (!this.env.CLOUDFLARE_AI_GATEWAY) {
			console.log(
				'ℹ️  AI Gateway setup skipped (CLOUDFLARE_AI_GATEWAY not provided)',
			);
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
				await aiGatewaySDK.aiGateway.get(gatewayName, {
					account_id: this.env.CLOUDFLARE_ACCOUNT_ID,
				});
				console.log(`✅ AI Gateway '${gatewayName}' already exists`);
				return;
			} catch (error: any) {
				// If error is not 404, log but continue
				if (
					error?.status !== 404 &&
					!error?.message?.includes('not found')
				) {
					console.warn(
						`⚠️  Could not check AI Gateway '${gatewayName}': ${error.message}`,
					);
					return;
				}
				// Gateway doesn't exist, continue to create it
			}

			// Validate gateway name length (64 character limit)
			if (gatewayName.length > 64) {
				console.warn(
					`⚠️  AI Gateway name too long (${gatewayName.length} > 64 chars), skipping creation`,
				);
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

			console.log(
				`✅ Successfully created AI Gateway: ${gatewayName} (authentication: ${aiGatewayToken ? 'enabled' : 'disabled'})`,
			);
		} catch (error) {
			// Non-blocking: Log warning but continue deployment
			console.warn(
				`⚠️  Could not create AI Gateway '${gatewayName}': ${error instanceof Error ? error.message : String(error)}`,
			);
			console.warn(
				'   Continuing deployment without AI Gateway setup...',
			);
		}
	}

	/**
	 * Verifies if the current API token has AI Gateway permissions
	 */
	private async checkTokenPermissions(): Promise<{
		hasAIGatewayAccess: boolean;
		tokenInfo?: any;
	}> {
		try {
			const verifyResponse = await fetch(
				'https://api.cloudflare.com/client/v4/user/tokens/verify',
				{
					headers: {
						Authorization: `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
					},
				},
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
			console.log(
				'ℹ️  Main API token verified, but will create dedicated AI Gateway token',
			);
			return { hasAIGatewayAccess: false, tokenInfo: verifyData.result };
		} catch (error) {
			console.warn(
				`⚠️  Token verification failed: ${error instanceof Error ? error.message : String(error)}`,
			);
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
		if (
			currentToken &&
			currentToken !== 'optional-your-cf-ai-gateway-token'
		) {
			console.log('✅ AI Gateway token already configured');
			// Initialize separate AI Gateway SDK instance
			this.aiGatewayCloudflare = new Cloudflare({
				apiToken: currentToken,
			});
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
						Authorization: `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						name: `AI Gateway Token - ${new Date().toISOString().split('T')[0]}`,
						policies: [
							{
								effect: 'allow',
								resources: {
									[`com.cloudflare.api.account.${this.env.CLOUDFLARE_ACCOUNT_ID}`]:
										'*',
								},
								permission_groups: [
									// Note: Using descriptive names, actual IDs would need to be fetched from the API
									{ name: 'AI Gateway Read' },
									{ name: 'AI Gateway Edit' },
									{ name: 'AI Gateway Run' }, // This is the key permission for authentication
									{ name: 'Workers AI Read' },
									{ name: 'Workers AI Edit' },
								],
							},
						],
						condition: {
							request_ip: { in: [], not_in: [] },
						},
						expires_on: new Date(
							Date.now() + 365 * 24 * 60 * 60 * 1000,
						).toISOString(), // 1 year
					}),
				},
			);

			if (!tokenResponse.ok) {
				const errorData = await tokenResponse
					.json()
					.catch(() => ({ errors: [{ message: 'Unknown error' }] }));
				throw new Error(
					`API token creation failed: ${errorData.errors?.[0]?.message || tokenResponse.statusText}`,
				);
			}

			const tokenData = await tokenResponse.json();

			if (tokenData.success && tokenData.result?.value) {
				const newToken = tokenData.result.value;
				console.log(
					'✅ AI Gateway authentication token created successfully',
				);
				console.log(`   Token ID: ${tokenData.result.id}`);
				console.warn(
					'⚠️  Please save this token and add it to CLOUDFLARE_AI_GATEWAY_TOKEN:',
				);
				console.warn(`   ${newToken}`);

				// Initialize separate AI Gateway SDK instance
				this.aiGatewayCloudflare = new Cloudflare({
					apiToken: newToken,
				});
				return newToken;
			} else {
				throw new Error(
					'Token creation succeeded but no token value returned',
				);
			}
		} catch (error) {
			// Non-blocking: Log warning but continue
			console.warn(
				`⚠️  Could not create AI Gateway token: ${error instanceof Error ? error.message : String(error)}`,
			);
			console.warn(
				'   AI Gateway will be created without authentication...',
			);
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
					cwd: PROJECT_ROOT,
				});
				console.log('✅ Templates repository cloned successfully');
			} else {
				console.log(
					'📁 Templates repository already exists, pulling latest changes...',
				);
				try {
					execSync('git pull origin main || git pull origin master', {
						stdio: 'pipe',
						cwd: templatesDir,
					});
					console.log('✅ Templates repository updated');
				} catch (pullError) {
					console.warn(
						'⚠️  Could not pull latest changes, continuing with existing templates',
					);
				}
			}

			// Find R2 bucket name from config
			const templatesBucket = this.config.r2_buckets?.find(
				(bucket) => bucket.binding === 'TEMPLATES_BUCKET',
			);

			if (!templatesBucket) {
				throw new Error(
					'TEMPLATES_BUCKET not found in wrangler.jsonc r2_buckets configuration',
				);
			}

			// Check if deploy script exists
			const deployScript = join(templatesDir, 'deploy_templates.sh');
			if (!existsSync(deployScript)) {
				console.warn(
					'⚠️  deploy_templates.sh not found in templates repository, skipping template deployment',
				);
				return;
			}

			// Make script executable
			execSync(`chmod +x "${deployScript}"`, { cwd: templatesDir });

			// Run deployment script with environment variables
			console.log(
				`🚀 Deploying templates to R2 bucket: ${templatesBucket.bucket_name}`,
			);

			const deployEnv = {
				...process.env,
				CLOUDFLARE_API_TOKEN: this.env.CLOUDFLARE_API_TOKEN,
				CLOUDFLARE_ACCOUNT_ID: this.env.CLOUDFLARE_ACCOUNT_ID,
				BUCKET_NAME: templatesBucket.bucket_name,
				R2_BUCKET_NAME: templatesBucket.bucket_name,
			};

			execSync('./deploy_templates.sh', {
				stdio: 'inherit',
				cwd: templatesDir,
				env: deployEnv,
			});

			console.log('✅ Templates deployed successfully to R2');
		} catch (error) {
			// Don't fail the entire deployment if templates fail
			console.warn(
				'⚠️  Templates deployment failed, but continuing with main deployment:',
			);
			console.warn(
				`   ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Updates package.json database commands with the actual database name from wrangler.jsonc
	 */
	private updatePackageJsonDatabaseCommands(): void {
		const databaseName = this.config.d1_databases?.[0]?.database_name;

		if (!databaseName) {
			console.log(
				'ℹ️  No D1 database found in wrangler.jsonc, skipping package.json database command update',
			);
			return;
		}

		console.log(
			`🔧 Updating package.json database commands with database: ${databaseName}`,
		);

		try {
			const packageJsonPath = join(PROJECT_ROOT, 'package.json');
			const content = readFileSync(packageJsonPath, 'utf-8');

			// Parse the package.json file
			const packageJson = JSON.parse(content);

			if (!packageJson.scripts) {
				console.warn('⚠️  No scripts section found in package.json');
				return;
			}

			// Update database migration commands
			const commandsToUpdate = ['db:migrate:local', 'db:migrate:remote'];

			let updated = false;
			commandsToUpdate.forEach((command) => {
				if (packageJson.scripts[command]) {
					const oldCommand = packageJson.scripts[command];

					// Replace any existing database name in the wrangler d1 migrations apply command
					const newCommand = oldCommand.replace(
						/wrangler d1 migrations apply [^\s]+ /,
						`wrangler d1 migrations apply ${databaseName} `,
					);

					if (newCommand !== oldCommand) {
						packageJson.scripts[command] = newCommand;
						console.log(
							`  ✅ Updated ${command}: ${oldCommand} → ${newCommand}`,
						);
						updated = true;
					}
				}
			});

			if (updated) {
				// Write back the updated package.json with proper formatting
				writeFileSync(
					packageJsonPath,
					JSON.stringify(packageJson, null, '\t'),
					'utf-8',
				);
				console.log(
					'✅ Updated package.json database commands successfully',
				);
			} else {
				console.log(
					'ℹ️  No database commands needed updating in package.json',
				);
			}
		} catch (error) {
			console.warn(
				`⚠️  Could not update package.json database commands: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Non-blocking - continue deployment
		}
	}

	/**
	 * Updates wrangler.jsonc routes and deployment settings based on CUSTOM_DOMAIN
	 */
	private updateCustomDomainRoutes(): void {
		const customDomain = this.config.vars?.CUSTOM_DOMAIN;

		try {
			const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');
			const content = readFileSync(wranglerPath, 'utf-8');

			if (!customDomain) {
				console.log(
					'ℹ️  CUSTOM_DOMAIN not set - removing routes and enabling workers.dev',
				);

				// Remove routes if they exist and set workers_dev=true, preview_urls=true
				let updatedContent = content;
				
				// Remove routes property if it exists
				const removeRoutesEdits = modify(content, ['routes'], undefined, {
					formattingOptions: {
						insertSpaces: true,
						keepLines: true,
						tabSize: 4
					}
				});
				updatedContent = applyEdits(updatedContent, removeRoutesEdits);
				
				// Set workers_dev = true
				const workersDevEdits = modify(updatedContent, ['workers_dev'], true, {
					formattingOptions: {
						insertSpaces: true,
						keepLines: true,
						tabSize: 4
					}
				});
				updatedContent = applyEdits(updatedContent, workersDevEdits);
				
				// Set preview_urls = true
				const previewUrlsEdits = modify(updatedContent, ['preview_urls'], true, {
					formattingOptions: {
						insertSpaces: true,
						keepLines: true,
						tabSize: 4
					}
				});
				updatedContent = applyEdits(updatedContent, previewUrlsEdits);

				// Write back the updated configuration
				writeFileSync(wranglerPath, updatedContent, 'utf-8');

				console.log('✅ Updated wrangler.jsonc for workers.dev deployment:');
				console.log('   - Removed routes configuration');
				console.log('   - Set workers_dev: true');
				console.log('   - Set preview_urls: true');
				return;
			}

			console.log(
				`🔧 Updating wrangler.jsonc routes with custom domain: ${customDomain}`,
			);

			// Parse the JSONC file
			const config = parse(content) as WranglerConfig;

			// Define the expected routes based on custom domain
			const expectedRoutes = [
				{ pattern: customDomain, custom_domain: true },
				{ pattern: `*${customDomain}/*`, custom_domain: false },
			];

			// Check if routes need updating
			let needsUpdate = false;

			if (!config.routes || !Array.isArray(config.routes)) {
				needsUpdate = true;
			} else if (config.routes.length !== expectedRoutes.length) {
				needsUpdate = true;
			} else {
				for (let i = 0; i < expectedRoutes.length; i++) {
					const expected = expectedRoutes[i];
					const actual = config.routes[i];

					if (
						actual.pattern !== expected.pattern ||
						actual.custom_domain !== expected.custom_domain
					) {
						needsUpdate = true;
						break;
					}
				}
			}

			if (!needsUpdate) {
				console.log(
					'ℹ️  Routes already match custom domain configuration',
				);
				return;
			}

			let updatedContent = content;

			// Update routes using jsonc-parser modify function
			const routesEdits = modify(content, ['routes'], expectedRoutes, {
				formattingOptions: {
					insertSpaces: true,
					keepLines: true,
					tabSize: 4
				}
			});
			updatedContent = applyEdits(updatedContent, routesEdits);

			// Set workers_dev = false for custom domain
			const workersDevEdits = modify(updatedContent, ['workers_dev'], false, {
				formattingOptions: {
					insertSpaces: true,
					keepLines: true,
					tabSize: 4
				}
			});
			updatedContent = applyEdits(updatedContent, workersDevEdits);

			// Set preview_urls = false for custom domain
			const previewUrlsEdits = modify(updatedContent, ['preview_urls'], false, {
				formattingOptions: {
					insertSpaces: true,
					keepLines: true,
					tabSize: 4
				}
			});
			updatedContent = applyEdits(updatedContent, previewUrlsEdits);

			// Write back the updated configuration
			writeFileSync(wranglerPath, updatedContent, 'utf-8');

			console.log(`✅ Updated wrangler.jsonc routes:`);
			console.log(`   Route 1: ${customDomain} (custom_domain: true)`);
			console.log(`   Route 2: *${customDomain}/* (custom_domain: false)`);
			console.log('   Set workers_dev: false');
			console.log('   Set preview_urls: false');
		} catch (error) {
			console.warn(
				`⚠️  Could not update custom domain routes: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Non-blocking - continue deployment
		}
	}

	/**
	 * Updates container configuration based on MAX_SANDBOX_INSTANCES (env var overrides wrangler.jsonc)
	 */
	private updateContainerConfiguration(): void {
		// Environment variable takes priority over wrangler.jsonc vars
		const maxInstances =
			process.env.MAX_SANDBOX_INSTANCES ||
			this.config.vars?.MAX_SANDBOX_INSTANCES;

		if (!maxInstances) {
			console.log(
				'ℹ️  MAX_SANDBOX_INSTANCES not set in environment variables or wrangler.jsonc vars, skipping container configuration update',
			);
			return;
		}

		const source = process.env.MAX_SANDBOX_INSTANCES
			? 'environment variable'
			: 'wrangler.jsonc vars';
		console.log(
			`🔧 Using MAX_SANDBOX_INSTANCES from ${source}: ${maxInstances}`,
		);

		const maxInstancesNum = parseInt(maxInstances, 10);
		if (isNaN(maxInstancesNum) || maxInstancesNum <= 0) {
			console.warn(
				`⚠️  Invalid MAX_SANDBOX_INSTANCES value: ${maxInstances}, skipping update`,
			);
			return;
		}

		console.log(
			`🔧 Updating container configuration: MAX_SANDBOX_INSTANCES=${maxInstancesNum}`,
		);

		try {
			const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');
			const content = readFileSync(wranglerPath, 'utf-8');

			// Parse the JSONC file to validate structure and find container index
			const config = parse(content) as WranglerConfig;

			if (!config.containers || !Array.isArray(config.containers)) {
				console.warn(
					'⚠️  No containers configuration found in wrangler.jsonc',
				);
				return;
			}

			// Find the index of UserAppSandboxService container
			const sandboxContainerIndex = config.containers.findIndex(
				(container) => container.class_name === 'UserAppSandboxService',
			);

			if (sandboxContainerIndex === -1) {
				console.warn(
					'⚠️  UserAppSandboxService container not found in wrangler.jsonc',
				);
				return;
			}

			const oldMaxInstances =
				config.containers[sandboxContainerIndex].max_instances;

			// Use jsonc-parser's modify function to properly edit the file
			// Path to the max_instances field: ['containers', index, 'max_instances']
			const edits = modify(
				content,
				['containers', sandboxContainerIndex, 'max_instances'],
				maxInstancesNum,
				{
                    formattingOptions: {
                        insertSpaces: true,
                        keepLines: true,
                        tabSize: 4
                    }
				},
			);

			// Apply the edits to get the updated content
			const updatedContent = applyEdits(content, edits);

			// Write back the updated configuration
			writeFileSync(wranglerPath, updatedContent, 'utf-8');

			console.log(
				`✅ Updated UserAppSandboxService max_instances: ${oldMaxInstances} → ${maxInstancesNum}`,
			);
		} catch (error) {
			throw new DeploymentError(
				'Failed to update container configuration',
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	/**
	 * Updates container instance types based on SANDBOX_INSTANCE_TYPE variable
	 */
	private updateContainerInstanceTypes(): void {
		// Environment variable takes priority over wrangler.jsonc vars
		const sandboxInstanceType = 
			process.env.SANDBOX_INSTANCE_TYPE || 
			this.config.vars?.SANDBOX_INSTANCE_TYPE || 
			'standard';

		console.log(
			`🔧 Configuring container instance types: ${sandboxInstanceType}`,
		);

		try {
			const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');
			const content = readFileSync(wranglerPath, 'utf-8');

			// Parse the JSONC file to validate structure and find container indices
			const config = parse(content) as WranglerConfig;

			if (!config.containers || !Array.isArray(config.containers)) {
				console.warn(
					'⚠️  No containers configuration found in wrangler.jsonc',
				);
				return;
			}

			// Find the indices of both containers
			const userAppContainerIndex = config.containers.findIndex(
				(container) => container.class_name === 'UserAppSandboxService',
			);
			const deployerContainerIndex = config.containers.findIndex(
				(container) => container.class_name === 'DeployerService',
			);

			if (userAppContainerIndex === -1) {
				console.warn(
					'⚠️  UserAppSandboxService container not found in wrangler.jsonc',
				);
				return;
			}

			if (deployerContainerIndex === -1) {
				console.warn(
					'⚠️  DeployerService container not found in wrangler.jsonc',
				);
				return;
			}

			// Determine the instance type configuration
			let userAppInstanceType: any;
			let deployerInstanceType: any;

			if (sandboxInstanceType === 'enhanced') {
				// Enhanced configuration as specified
				userAppInstanceType = {
					vcpu: 4,
					memory_mib: 4096,
					disk_mb: 10240
				};
				// DeployerService keeps similar enhanced config but with less memory
				deployerInstanceType = {
					vcpu: 4,
					memory_mib: 4096,
					disk_mb: 5120
				};
				console.log('   Using enhanced instance type configuration');
			} else {
				// Use the string value directly
				userAppInstanceType = sandboxInstanceType;
				deployerInstanceType = sandboxInstanceType;
				console.log(`   Using instance type string: ${sandboxInstanceType}`);
			}

			// Update UserAppSandboxService instance_type
			let updatedContent = content;
			const userAppInstanceTypeEdits = modify(
				updatedContent,
				['containers', userAppContainerIndex, 'instance_type'],
				userAppInstanceType,
				{
					formattingOptions: {
						insertSpaces: true,
						keepLines: true,
						tabSize: 4
					}
				}
			);
			updatedContent = applyEdits(updatedContent, userAppInstanceTypeEdits);

			// Update DeployerService instance_type
			const deployerInstanceTypeEdits = modify(
				updatedContent,
				['containers', deployerContainerIndex, 'instance_type'],
				deployerInstanceType,
				{
					formattingOptions: {
						insertSpaces: true,
						keepLines: true,
						tabSize: 4
					}
				}
			);
			updatedContent = applyEdits(updatedContent, deployerInstanceTypeEdits);

			// Write back the updated configuration
			writeFileSync(wranglerPath, updatedContent, 'utf-8');

			console.log(
				`✅ Updated container instance types for SANDBOX_INSTANCE_TYPE: ${sandboxInstanceType}`,
			);
			console.log(
				`   UserAppSandboxService: ${JSON.stringify(userAppInstanceType)}`,
			);
			console.log(
				`   DeployerService: ${JSON.stringify(deployerInstanceType)}`,
			);

		} catch (error) {
			console.warn(
				`⚠️  Could not update container instance types: ${error instanceof Error ? error.message : String(error)}`,
			);
			console.warn('   Continuing with current configuration...');
			// Non-blocking - continue deployment
		}
	}

	/**
	 * Cleans Wrangler cache and build artifacts
	 */
	private cleanWranglerCache(): void {
		console.log('🧹 Cleaning Wrangler cache and build artifacts...');

		try {
			// Remove .wrangler directory (contains wrangler cache and state)
			execSync('rm -rf .wrangler', {
				stdio: 'pipe',
				cwd: PROJECT_ROOT,
			});
			console.log('   ✅ Removed .wrangler directory');

			// Remove wrangler.json files from dist/* directories
			// Use find to locate and remove any wrangler.json files in dist subdirectories
			try {
				execSync('find dist -name "wrangler.json" -type f -delete 2>/dev/null || true', {
					stdio: 'pipe',
					cwd: PROJECT_ROOT,
				});
				console.log('   ✅ Removed cached wrangler.json files from dist');
			} catch (findError) {
				// Non-critical - continue if find fails
				console.log('   ℹ️  No cached wrangler.json files found in dist');
			}

			console.log('✅ Cache cleanup completed');
		} catch (error) {
			// Non-blocking - log warning but continue
			console.warn(
				`⚠️  Cache cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			console.warn('   Continuing with deployment...');
		}
	}

	/**
	 * Builds the project (clean dist and run build)
	 */
	private async buildProject(): Promise<void> {
		console.log('🔨 Building project...');

		try {
			// Run build
			execSync('bun run build', {
				stdio: 'inherit',
				cwd: PROJECT_ROOT,
			});

			console.log('✅ Project build completed');
		} catch (error) {
			throw new DeploymentError(
				'Failed to build project',
				error instanceof Error ? error : new Error(String(error)),
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
				cwd: PROJECT_ROOT,
			});

			console.log('✅ Wrangler deployment completed');
		} catch (error) {
			throw new DeploymentError(
				'Failed to deploy with Wrangler',
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	/**
	 * Temporarily removes conflicting vars from wrangler.jsonc before deployment
	 * Returns the original vars for restoration later
	 */
	private async removeConflictingVars(): Promise<Record<string, string> | null> {
		const prodVarsPath = join(PROJECT_ROOT, '.prod.vars');
		
		if (!existsSync(prodVarsPath)) {
			console.log('ℹ️  No .prod.vars file found, skipping conflict resolution');
			return null;
		}

		try {
			console.log('🔍 Checking for var/secret conflicts...');
			
			// Read .prod.vars to see which secrets will be uploaded
			const prodVarsContent = readFileSync(prodVarsPath, 'utf-8');
			const secretVarNames = new Set<string>();
			
			prodVarsContent.split('\n').forEach(line => {
				line = line.trim();
				if (line && !line.startsWith('#') && line.includes('=')) {
					const varName = line.split('=')[0].trim();
					secretVarNames.add(varName);
				}
			});

			// Check which vars in wrangler.jsonc conflict with secrets
			const conflictingVars: Record<string, string> = {};
			const originalVars = { ...(this.config.vars || {}) };

			Object.keys(originalVars).forEach(varName => {
				if (secretVarNames.has(varName)) {
					conflictingVars[varName] = originalVars[varName] || '';
					console.log(`🔄 Found conflict: ${varName} (will be moved from var to secret)`);
				}
			});

			if (Object.keys(conflictingVars).length === 0) {
				console.log('✅ No var/secret conflicts found');
				return null;
			}

			console.log(`⚠️  Temporarily removing ${Object.keys(conflictingVars).length} conflicting vars from wrangler.jsonc`);

			// Remove conflicting vars from wrangler.jsonc
			const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');
			const content = readFileSync(wranglerPath, 'utf-8');
			
			const updatedVars = { ...originalVars };
			Object.keys(conflictingVars).forEach(varName => {
				delete updatedVars[varName];
			});

			// Update wrangler.jsonc with vars removed
			const edits = modify(
				content,
				['vars'],
				updatedVars,
				{
                    formattingOptions: {
                        insertSpaces: true,
                        keepLines: true,
                        tabSize: 4
                    }
                }
			);

			const updatedContent = applyEdits(content, edits);
			writeFileSync(wranglerPath, updatedContent, 'utf-8');

			console.log('✅ Temporarily removed conflicting vars from wrangler.jsonc');
			return conflictingVars;

		} catch (error) {
			console.warn(`⚠️  Could not remove conflicting vars: ${error instanceof Error ? error.message : String(error)}`);
			return null;
		}
	}

	/**
	 * Restores the original vars to wrangler.jsonc after deployment
	 */
	private async restoreOriginalVars(originalConflictingVars: Record<string, string> | null): Promise<void> {
		if (!originalConflictingVars || Object.keys(originalConflictingVars).length === 0) {
			return;
		}

		try {
			console.log('🔄 Restoring original vars to wrangler.jsonc...');
			
			const wranglerPath = join(PROJECT_ROOT, 'wrangler.jsonc');
			const content = readFileSync(wranglerPath, 'utf-8');
			const config = parse(content) as WranglerConfig;
			
			// Merge back the conflicting vars
			const restoredVars = {
				...(config.vars || {}),
				...originalConflictingVars
			};

			const edits = modify(
				content,
				['vars'],
				restoredVars,
				{
                    formattingOptions: {
                        insertSpaces: true,
                        keepLines: true,
                        tabSize: 4
                    }
                }
			);

			const updatedContent = applyEdits(content, edits);
			writeFileSync(wranglerPath, updatedContent, 'utf-8');

			console.log(`✅ Restored ${Object.keys(originalConflictingVars).length} original vars to wrangler.jsonc`);
			
		} catch (error) {
			console.warn(`⚠️  Could not restore original vars: ${error instanceof Error ? error.message : String(error)}`);
			console.warn('   You may need to manually restore wrangler.jsonc vars');
		}
	}

	/**
	 * Creates .prod.vars file with current environment variables
	 */
	private createProdVarsFile(): void {
		const prodVarsPath = join(PROJECT_ROOT, '.prod.vars');

		console.log(
			'📝 Creating .prod.vars file from environment variables...',
		);

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
			'MAX_SANDBOX_INSTANCES',
		];

		const prodVarsContent: string[] = [
			'# Production environment variables for Cloudflare Orange Build',
			'# Generated automatically during deployment',
			'',
			'# Essential Secrets:',
		];

		// Add environment variables that are set
		secretVars.forEach((varName) => {
			const value = process.env[varName];
			if (value && value !== '') {
				// Skip placeholder values
				if (
					value.startsWith('optional-') ||
					value.startsWith('your-')
				) {
					prodVarsContent.push(
						`# ${varName}="${value}" # Placeholder - update with actual value`,
					);
				} else {
					prodVarsContent.push(`${varName}="${value}"`);
				}
			} else {
				prodVarsContent.push(
					`# ${varName}="" # Not set in current environment`,
				);
			}
		});

		// Add environment marker
		prodVarsContent.push('');
		// prodVarsContent.push('ENVIRONMENT="production"');

		try {
			writeFileSync(
				prodVarsPath,
				prodVarsContent.join('\n') + '\n',
				'utf-8',
			);
			console.log(
				`✅ Created .prod.vars file with ${secretVars.length} environment variables`,
			);
		} catch (error) {
			console.warn(
				`⚠️  Could not create .prod.vars file: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new DeploymentError(
				'Failed to create .prod.vars file',
				error instanceof Error ? error : new Error(String(error)),
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
				console.log(
					'📋 .prod.vars file not found, creating from environment variables...',
				);
				this.createProdVarsFile();
			}

			// Verify file exists after creation attempt
			if (!existsSync(prodVarsPath)) {
				console.warn(
					'⚠️  Could not create .prod.vars file, skipping secret update',
				);
				return;
			}

			execSync('wrangler secret bulk .prod.vars', {
				stdio: 'inherit',
				cwd: PROJECT_ROOT,
			});

			console.log('✅ Production secrets updated successfully');
		} catch (error) {
			// Non-blocking: Log warning but don't fail deployment
			console.warn(
				`⚠️  Could not update secrets: ${error instanceof Error ? error.message : String(error)}`,
			);
			console.warn(
				'   You may need to update secrets manually if required',
			);
		}
	}

	/**
	 * Main deployment orchestration method
	 */
	public async deploy(): Promise<void> {
		console.log(
			'🧡 Cloudflare Orange Build - Automated Deployment Starting...\n',
		);

		const startTime = Date.now();

		try {
			// Step 1: Early Configuration Updates (must happen before any wrangler commands)
            this.cleanWranglerCache();
			console.log('\n📋 Step 1: Updating configuration files...');
			console.log('   🔧 Updating package.json database commands');
			this.updatePackageJsonDatabaseCommands();

			console.log('   🔧 Updating wrangler.jsonc custom domain routes');
			this.updateCustomDomainRoutes();

			console.log('   🔧 Updating container instance types');
			this.updateContainerInstanceTypes();

			console.log('✅ Configuration files updated successfully!\n');

			// Step 2: Update container configuration if needed
			console.log('\n📋 Step 2: Updating container configuration...');
			this.updateContainerConfiguration();

			// Step 3: Resolve var/secret conflicts before deployment
			console.log('\n📋 Step 3: Resolving var/secret conflicts...');
			const conflictingVars = await this.removeConflictingVars();

			// Steps 2-4: Run all setup operations in parallel
			const operations: Promise<void>[] = [
				this.ensureDispatchNamespace(),
				this.deployTemplates(),
				this.buildProject(),
			];

			// Add AI Gateway setup if gateway name is provided
			if (this.env.CLOUDFLARE_AI_GATEWAY) {
				operations.push(this.ensureAIGateway());
				console.log(
					'📋 Step 4: Running all setup operations in parallel...',
				);
				console.log('   🔄 Workers for Platforms namespace setup');
				console.log('   🔄 Templates repository deployment');
				console.log('   🔄 Project build (clean + compile)');
				console.log('   🔄 AI Gateway setup and configuration');
			} else {
				console.log(
					'📋 Step 4: Running all setup operations in parallel...',
				);
				console.log('   🔄 Workers for Platforms namespace setup');
				console.log('   🔄 Templates repository deployment');
				console.log('   🔄 Project build (clean + compile)');
			}

			await Promise.all(operations);

			console.log(
				'✅ Parallel setup and build operations completed!',
			);

			let deploymentSucceeded = false;
			try {
				// Step 5: Deploy with Wrangler (now without conflicts)
				console.log('\n📋 Step 5: Deploying to Cloudflare Workers...');
				await this.wranglerDeploy();

				// Step 6: Update secrets (now no conflicts)
				console.log('\n📋 Step 6: Updating production secrets...');
				await this.updateSecrets();

				deploymentSucceeded = true;
			} finally {
				// Step 7: Always restore original vars (even if deployment failed)
				console.log('\n📋 Step 7: Restoring original configuration...');
				await this.restoreOriginalVars(conflictingVars);
			}

			// Deployment complete
			if (deploymentSucceeded) {
				const duration = Math.round((Date.now() - startTime) / 1000);
				console.log(
					`\n🎉 Complete deployment finished successfully in ${duration}s!`,
				);
				console.log(
					'✅ Your Cloudflare Orange Build platform is now live! 🚀',
				);
			} else {
				throw new DeploymentError('Deployment failed during wrangler deploy or secret update');
			}
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
			console.error(
				'   - Verify all environment variables are correctly set',
			);
			console.error(
				'   - Check your Cloudflare API token has required permissions',
			);
			console.error(
				'   - Ensure your account has access to Workers for Platforms',
			);
			console.error('   - Verify the templates repository is accessible');
			console.error(
				'   - Check that bun is installed and build script works',
			);

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
