import { CodeGenState } from "../../../agents/core/state";
import { PreviewType } from "../../../services/sandbox/sandboxTypes";

/**
 * Data structure for getAgentState response
 */
export interface AgentStateData {
    agentId: string;
    websocketUrl: string;
    state: CodeGenState;
}

/**
 * Data structure for connectToExistingAgent response
 */
export interface AgentConnectionData {
    websocketUrl: string;
    agentId: string;
}

export interface AgentPreviewResponse extends PreviewType {
}
    