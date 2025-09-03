import { AgentActionType } from '../schemas';
import { Agent } from 'agents';
import { CodeGenState } from './state';

interface AgentWithLogger extends Agent<Env, CodeGenState> {
    logger?: {
        info: (message: string) => void;
    };
}

export async function executeAction(agent: AgentWithLogger, action: AgentActionType): Promise<void> {
    agent.logger?.info(`Executing action: ${action.action}`);
}
    