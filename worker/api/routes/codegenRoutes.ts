import { Router } from '../router';
import { CodeGenController } from '../controllers/codeGenController';
import { setupAuthRoutes } from './authRoutes';
import { setupAppRoutes } from './appRoutes';
import { setupStatsRoutes } from './statsRoutes';
import { setupWebhookRoutes } from './webhookRoutes';
import { setupIntegrationRoutes } from './integrationRoutes';
import { setupSecretsRoutes } from './secretsRoutes';
// import { handleInsertRag, handleQueryRag } from "./rag";

// Export the CodeGenerator Agent as a Durable Object class named CodeGen

/**
 * Setup and configure the application router
 */
export function setupRouter(): Router {
    const router = new Router();
    const codeGenController = new CodeGenController();

    // Code generation endpoints - modern incremental API
    // router.get('/api/codegen/template', codeGenController.searchTemplates.bind(codeGenController));
    router.post('/api/codegen/incremental', codeGenController.startCodeGeneration.bind(codeGenController));
    router.get('/api/codegen/incremental/:agentId', codeGenController.getCodeGenerationProgress.bind(codeGenController));

    // WebSocket endpoint for real-time code generation updates
    router.register('/api/codegen/ws/:agentId', codeGenController.handleWebSocketConnection.bind(codeGenController), ['GET']);

    // Connect to existing agent
    router.get('/api/agent/:agentId', codeGenController.connectToExistingAgent.bind(codeGenController));

    // Default codegen path
    router.post('/api/codegen', codeGenController.startCodeGeneration.bind(codeGenController));
    
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
    
    return router;
}