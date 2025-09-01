/**
 * GitHub Service
 */

import { createLogger } from '../../logger';
import {
    GitHubRepository,
    CreateRepositoryOptions,
    CreateRepositoryResult,
} from './types';

export class GitHubService {
    private logger = createLogger('GitHubService');

    constructor() {}

    private createHeaders(token: string, includeContentType = false): Record<string, string> {
        const headers: Record<string, string> = {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Cloudflare-OrangeBuild/1.0',
        };

        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }

        return headers;
    }
    /**
     * Create a new repository for user account
     */
    async createUserRepository(
        options: CreateRepositoryOptions,
        userAccessToken: string
    ): Promise<CreateRepositoryResult> {
        try {
            const response = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: this.createHeaders(userAccessToken, true),
                body: JSON.stringify({
                    name: options.name,
                    description: options.description,
                    private: options.private,
                    auto_init: options.auto_init || false,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                this.logger.error('Repository creation failed', {
                    status: response.status,
                    statusText: response.statusText,
                    error: error,
                    endpoint: 'https://api.github.com/user/repos'
                });
                
                // Provide helpful error message for permission issues
                if (response.status === 403) {
                    return {
                        success: false,
                        error: `GitHub App lacks required permissions. Please ensure the app has 'Contents: Write' and 'Metadata: Read' permissions, then re-install it.`
                    };
                }
                
                return {
                    success: false,
                    error: `Failed to create repository: ${error}`
                };
            }

            const repository = (await response.json()) as GitHubRepository;
            this.logger.info(`Successfully created repository: ${repository.html_url}`);

            return {
                success: true,
                repository
            };
        } catch (error) {
            this.logger.error('Failed to create user repository', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

}