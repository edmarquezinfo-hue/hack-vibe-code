import { AgentActionType } from '../schemas';
import { Agent } from 'agents';
import { CodeGenState } from './state';

export async function executeAction(agent: Agent<Env, CodeGenState>, action: AgentActionType): Promise<void> {
    // @ts-ignore - agent.logger exists on our implementation
    agent.logger?.info(`Executing action: ${action.action}`);
}
    