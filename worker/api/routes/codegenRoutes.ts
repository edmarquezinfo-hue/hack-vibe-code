import { Router, AuthConfig } from '../router';
import { CodingAgentController } from '../controllers/agent/controller';
import { setupAuthRoutes } from './authRoutes';
import { setupAppRoutes } from './appRoutes';
import { setupUserRoutes } from './userRoutes';
import { setupStatsRoutes } from './statsRoutes';
import { setupAnalyticsRoutes } from './analyticsRoutes';
import { setupWebhookRoutes } from './webhookRoutes';
import { setupIntegrationRoutes } from './integrationRoutes';
import { setupSecretsRoutes } from './secretsRoutes';
import { setupModelConfigRoutes } from './modelConfigRoutes';
import { setupModelProviderRoutes } from './modelProviderRoutes';
// import { handleInsertRag, handleQueryRag } from "./rag";

// Export the CodeGenerator Agent as a Durable Object class named CodeGen

/**
 * Setup and configure the application router
 */
export function setupRouter(): Router {
    const router = new Router();
    const codingAgentController = new CodingAgentController();

    // ========================================
    // CODE GENERATION ROUTES
    // ========================================
    
    // CRITICAL: Create new app - requires full authentication
    router.post('/api/agent', codingAgentController.startCodeGeneration.bind(codingAgentController), AuthConfig.authenticated);
    
    // Get agent state - PUBLIC for app viewing (/app/:id frontend route)
    // Allows unauthenticated users to view app details and generated code
    router.get('/api/agent/:agentId', codingAgentController.getAgentState.bind(codingAgentController), AuthConfig.public);
    
    // ========================================
    // APP EDITING ROUTES (/chat/:id frontend)
    // ========================================
    
    // WebSocket for app editing - OWNER ONLY (for /chat/:id route)
    // Only the app owner should be able to connect and modify via WebSocket
    router.register('/api/agent/:agentId/ws', codingAgentController.handleWebSocketConnection.bind(codingAgentController), ['GET'], AuthConfig.ownerOnly);
    
    // Connect to existing agent for editing - OWNER ONLY
    // Only the app owner should be able to connect for editing purposes
    router.get('/api/agent/:agentId/connect', codingAgentController.connectToExistingAgent.bind(codingAgentController), AuthConfig.ownerOnly);

    router.get('/api/agent/:agentId/preview', codingAgentController.deployPreview.bind(codingAgentController), AuthConfig.public);

    // Authentication and user management routes
    setupAuthRoutes(router);
    
    // User dashboard and profile routes
    setupUserRoutes(router);
    
    // App management routes
    setupAppRoutes(router);
    
    // Stats routes
    setupStatsRoutes(router);
    
    // AI Gateway Analytics routes
    setupAnalyticsRoutes(router);
    
    // Webhook routes
    setupWebhookRoutes(router);
    
    // Integration routes
    setupIntegrationRoutes(router);
    
    // Secrets management routes
    setupSecretsRoutes(router);
    
    // Model configuration and provider keys routes
    setupModelConfigRoutes(router);
    
    // Model provider routes
    setupModelProviderRoutes(router);
    
    return router;
}