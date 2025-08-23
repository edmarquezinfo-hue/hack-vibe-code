import { CodeGenState } from "../../../agents/core/state";
import { CodeOutputType } from "../../../agents/schemas";

/**
 * Data structure for getAgentState response
 */
export interface AgentStateData {
    agentId: string;
    websocketUrl: string;
    progress: CodeOutputType;
    state: CodeGenState;
}

/**
 * Data structure for connectToExistingAgent response
 */
export interface AgentConnectionData {
    websocketUrl: string;
    agentId: string;
}

/**
 * Generation REST API response - matches ApiResponse structure
 */
export interface CodeGenerationResponse {
    success: boolean;
    data: AgentStateData;
    statusCode: number;
}

/**
 * Agent connection REST API response
 */
export interface AgentConnectionResponse {
    success: boolean;
    data: AgentConnectionData;
    statusCode: number;
}