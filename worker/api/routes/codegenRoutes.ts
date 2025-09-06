import { Router, AuthConfig } from '../router';
import { CodingAgentController } from '../controllers/agent/controller';

/**
 * Setup and configure the application router
 */
export function setupCodegenRoutes(env: Env, router: Router): Router {
    const codingAgentController = new CodingAgentController(env);

    // ========================================
    // CODE GENERATION ROUTES
    // ========================================
    
    // CRITICAL: Create new app - requires full authentication
    router.post('/api/agent', codingAgentController.startCodeGeneration.bind(codingAgentController), AuthConfig.authenticated);
    
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
    return router;
}