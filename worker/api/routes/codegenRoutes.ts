import { Router } from '../router';
import { CodingAgentController } from '../controllers/codingAgentController';
import { setupAuthRoutes } from './authRoutes';
import { setupAppRoutes } from './appRoutes';
import { setupStatsRoutes } from './statsRoutes';
import { setupWebhookRoutes } from './webhookRoutes';
import { setupIntegrationRoutes } from './integrationRoutes';
import { setupSecretsRoutes } from './secretsRoutes';
import { setupModelConfigRoutes } from './modelConfigRoutes';
// import { handleInsertRag, handleQueryRag } from "./rag";

// Export the CodeGenerator Agent as a Durable Object class named CodeGen

/**
 * Setup and configure the application router
 */
export function setupRouter(): Router {
    const router = new Router();
    const codingAgentController = new CodingAgentController();

    // Code generation endpoints - modern incremental API
    router.post('/api/agent', codingAgentController.startCodeGeneration.bind(codingAgentController));
    // WebSocket endpoint for real-time code generation updates
    router.register('/api/agent/:agentId/ws', codingAgentController.handleWebSocketConnection.bind(codingAgentController), ['GET']);
    // Connect to existing agent
    router.get('/api/agent/:agentId/connect', codingAgentController.connectToExistingAgent.bind(codingAgentController));    
    // Get comprehensive agent state (for app viewing)
    router.get('/api/agent/:agentId', codingAgentController.getAgentState.bind(codingAgentController));

    // Authentication and user management routes
    setupAuthRoutes(router);
    
    // App management routes
    setupAppRoutes(router);
    
    // Stats routes
    setupStatsRoutes(router);
    
    // Webhook routes
    setupWebhookRoutes(router);
    
    // Integration routes
    setupIntegrationRoutes(router);
    
    // Secrets management routes
    setupSecretsRoutes(router);
    
    // Model configuration and provider keys routes
    setupModelConfigRoutes(router);
    
    return router;
}