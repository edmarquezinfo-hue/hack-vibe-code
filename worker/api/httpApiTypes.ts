import { CodeGenState } from "../agents/core/state";
import { CodeOutputType } from "../agents/schemas";

/**
 * Generation REST API response
 */
export interface CodeGenerationResponse {
	success: boolean;
	data: {
        agentId: string;
        websocketUrl: string;
        progress: CodeOutputType;
        state: CodeGenState;
	};
	statusCode: number;
}