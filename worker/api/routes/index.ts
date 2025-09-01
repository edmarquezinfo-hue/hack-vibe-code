import { Router } from "../router";
import { setupAuthRoutes } from './authRoutes';
import { setupAppRoutes } from './appRoutes';
import { setupUserRoutes } from './userRoutes';
import { setupStatsRoutes } from './statsRoutes';
import { setupAnalyticsRoutes } from './analyticsRoutes';
import { setupSecretsRoutes } from './secretsRoutes';
import { setupModelConfigRoutes } from './modelConfigRoutes';
import { setupModelProviderRoutes } from './modelProviderRoutes';
import { setupGitHubExporterRoutes } from './githubExporterRoutes';
import { setupCodegenRoutes } from './codegenRoutes';

export function setupRoutes(env: Env): Router {
    const router = new Router();

    // Codegen routes
    setupCodegenRoutes(env, router);

    // Authentication and user management routes
    setupAuthRoutes(env, router);
    
    // User dashboard and profile routes
    setupUserRoutes(env, router);
    
    // App management routes
    setupAppRoutes(env, router);
    
    // Stats routes
    setupStatsRoutes(env, router);
    
    // AI Gateway Analytics routes
    setupAnalyticsRoutes(env, router);
    
    // Secrets management routes
    setupSecretsRoutes(env, router);
    
    // Model configuration and provider keys routes
    setupModelConfigRoutes(env, router);
    
    // Model provider routes
    setupModelProviderRoutes(env, router);
    
    // GitHub Exporter routes
    setupGitHubExporterRoutes(env, router);
    
    return router;
}