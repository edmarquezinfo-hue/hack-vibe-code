/**
 * GitHub App Controller
 * Handles GitHub App installation and repository export flows
 */

import { BaseController } from '../BaseController';
import { RouteContext } from '../../types/route-context';
import { GitHubService } from '../../../services/github';
import { createLogger } from '../../../logger';
import { getAgentStub } from '../../../agents';

export interface GitHubAppInstallationData {
	installationId: number;
	username: string;
	repositories?: string[];
}

export interface GitHubAppExportData {
	success: boolean;
	repositoryUrl?: string;
	error?: string;
}

interface GitHubOAuthCallbackState {
	userId: string;
	timestamp: number;
	purpose: 'user_repo_access' | 'repository_export';
	agentId?: string; // For file pushing during repository export
	returnUrl: string;
	exportData?: {
		repositoryName: string;
		description?: string;
		isPrivate?: boolean;
	};
}

export class GitHubAppController extends BaseController {
	protected logger = createLogger('GitHubAppController');

	constructor() {
		super();
	}
    
	/**
	 * Handle GitHub OAuth callback and exchange code for user access token
	 */
	async handleOAuthCallback(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
		context: RouteContext,
	): Promise<Response> {
		try {
			const code = context.queryParams.get('code');
			const stateParam = context.queryParams.get('state');
			const error = context.queryParams.get('error');

			if (error) {
				this.logger.error('OAuth authorization error', { error });
				return Response.redirect(
					`${new URL(request.url).origin}/settings?integration=github&status=error&reason=${encodeURIComponent(error)}`,
					302,
				);
			}

			if (!code) {
				return Response.redirect(
					`${new URL(request.url).origin}/settings?integration=github&status=error&reason=missing_code`,
					302,
				);
			}

			// Extract user ID and purpose from state parameter
			let parsedState: GitHubOAuthCallbackState | null = null;
			
			if (stateParam) {
				try {
					parsedState = JSON.parse(
						Buffer.from(stateParam, 'base64').toString(),
					) as GitHubOAuthCallbackState;
				} catch (error) {
					this.logger.error('Failed to parse OAuth state parameter', error);
				}
			}

			if (!parsedState || !parsedState.userId) {
				return Response.redirect(
					`${new URL(request.url).origin}/settings?integration=github&status=error&reason=invalid_state`,
					302,
				);
			}

			const { userId, purpose, agentId, exportData, returnUrl } = parsedState;

			if (!userId) {
				return Response.redirect(
					`${new URL(request.url).origin}/settings?integration=github&status=error&reason=invalid_state`,
					302,
				);
			}

			const githubService = new GitHubService(env);
			const baseUrl = new URL(request.url).origin;
			
			// Exchange code for user access token
			const tokenResult = await githubService.exchangeCodeForUserToken(
				code,
				`${baseUrl}/api/github-app/oauth-callback`
			);

			if (!tokenResult.success || !tokenResult.token) {
				this.logger.error('Failed to exchange OAuth code', { 
					error: tokenResult.error,
					userId 
				});
				
				if (purpose === 'repository_export') {
					return Response.redirect(
						`${returnUrl}?github_export=error&reason=token_exchange_failed`,
						302,
					);
				}
				
				return Response.redirect(
					`${returnUrl}?integration=github&status=error&reason=token_exchange_failed`,
					302,
				);
			}

			this.logger.info('OAuth authorization successful', {
				userId,
				tokenLength: tokenResult.token.length,
				purpose
			});

			// Handle different purposes
			if (purpose === 'repository_export' && exportData) {
				// Create repository immediately using the user access token
				const githubService = new GitHubService(env);
				
				const createResult = await githubService.createUserRepository(
					{
						name: exportData.repositoryName,
						description: exportData.description,
						private: exportData.isPrivate || false,
						auto_init: false
					},
					tokenResult.token
				);

				if (!createResult.success || !createResult.repository) {
					this.logger.error('Failed to create repository during export', {
						error: createResult.error,
						userId,
						repositoryName: exportData.repositoryName
					});
					return Response.redirect(
						`${returnUrl}?github_export=error&reason=${encodeURIComponent(createResult.error || 'repository_creation_failed')}`,
						302,
					);
				}

				this.logger.info('Repository created successfully, now pushing files', {
					userId,
					repositoryUrl: createResult.repository.html_url,
					repositoryName: exportData.repositoryName,
					agentId
				});

				// Step 2: Push files to the repository if agentId is available
				if (agentId) {
					try {
						// Get the agent stub
						const agentStub = await getAgentStub(env, agentId, true, this.logger);

						const pushRequest = {
							cloneUrl: createResult.repository.clone_url,
							repositoryHtmlUrl: createResult.repository.html_url,
							isPrivate: createResult.repository.private,
							token: tokenResult.token,
							email: 'noreply@v1dev.com',
							username: 'v1dev-bot',
							commitMessage: `Initial commit - Generated app\n\n🤖 Generated with v1dev\nRepository: ${exportData.repositoryName}`
						};

						this.logger.info('Pushing files to repository via agent', {
							agentId,
							repositoryUrl: createResult.repository.html_url
						});

						const pushResult = await agentStub.pushToGitHub(pushRequest);

						if (!pushResult?.success) {
							this.logger.error('Failed to push files to repository', {
								error: pushResult?.error,
								agentId,
								repositoryUrl: createResult.repository.html_url
							});
							return Response.redirect(
								`${returnUrl}?github_export=error&reason=${encodeURIComponent(pushResult?.error || 'file_push_failed')}`,
								302,
							);
						}

						this.logger.info('Successfully completed GitHub export with files', {
							userId,
							agentId,
							repositoryUrl: createResult.repository.html_url,
							repositoryName: exportData.repositoryName
						});
					} catch (pushError) {
						this.logger.error('Error during file push', {
							error: pushError,
							agentId,
							repositoryUrl: createResult.repository.html_url
						});
						return Response.redirect(
							`${returnUrl}?github_export=error&reason=${encodeURIComponent('file_push_error')}`,
							302,
						);
					}
				} else {
					this.logger.warn('No agentId provided - repository created but files not pushed', {
						repositoryUrl: createResult.repository.html_url
					});
				}

				// Redirect back with success and repository URL
				return Response.redirect(
					`${returnUrl}?github_export=success&repository_url=${encodeURIComponent(createResult.repository.html_url)}`,
					302,
				);
			}

			// Default: user authorization success
			return Response.redirect(
				`${returnUrl}?integration=github&status=oauth_success`,
				302,
			);
		} catch (error) {
			this.logger.error('Failed to handle OAuth callback', error);
			return Response.redirect(
				`${new URL(request.url).origin}/settings?integration=github&status=error`,
				302,
			);
		}
	}

	/**
	 * Initiate GitHub export with OAuth flow
	 * This will redirect user to GitHub OAuth, then create repository upon callback
	 */
	async initiateGitHubExport(
		request: Request,
		env: Env,
		_ctx: ExecutionContext,
		context: RouteContext,
	): Promise<Response> {
		try {
			if (!context.user) {
				return this.createErrorResponse<never>(
					'Authentication required',
					401,
				);
			}

			const body = await request.json() as {
				repositoryName: string;
				description?: string;
				isPrivate?: boolean;
				agentId: string;
			};

			if (!body.repositoryName) {
				return this.createErrorResponse<never>(
					'Repository name is required',
					400,
				);
			}

			if (!body.agentId) {
				return this.createErrorResponse<never>(
					'Instance ID is required for file pushing',
					400,
				);
			}

			const githubService = new GitHubService(env);

			// Generate state with export parameters
			const state = JSON.stringify({
				userId: context.user.id,
				timestamp: Date.now(),
				purpose: 'repository_export',
				agentId: body.agentId, // Include for file pushing
				exportData: {
					repositoryName: body.repositoryName,
					description: body.description,
					isPrivate: body.isPrivate
				},
				returnUrl: request.headers.get('referer') || `${new URL(request.url).origin}/chat`,
			});

			const baseUrl = new URL(request.url).origin;
			const authUrl = githubService.generateUserAuthorizationUrl(
				Buffer.from(state).toString('base64'),
				`${baseUrl}/api/github-app/oauth-callback`
			);

			this.logger.info('Initiating GitHub export with OAuth', {
				userId: context.user.id,
				repositoryName: body.repositoryName,
			});

			// Return the authorization URL for frontend redirect
			return this.createSuccessResponse<{ authUrl: string }>({
				authUrl
			});
		} catch (error) {
			this.logger.error('Failed to initiate GitHub export', error);
			return this.createErrorResponse<never>(
				'Failed to initiate GitHub export',
				500,
			);
		}
	}

}
