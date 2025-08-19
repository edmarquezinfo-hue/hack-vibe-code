
import { SmartCodeGeneratorAgent } from './core/smartGeneratorAgent';
import { getAgentByName } from 'agents';
import { CodeGenState } from './core/state';
import { generateId } from '../utils/idGenerator';

export async function getAgentStub(env: Env, agentId: string, searchInOtherJurisdictions: boolean = false) : Promise<DurableObjectStub<SmartCodeGeneratorAgent>> {
    if (searchInOtherJurisdictions) {
        // Try multiple jurisdictions until we find the agent
        const jurisdictions = [undefined, 'eu' as DurableObjectJurisdiction];
        for (const jurisdiction of jurisdictions) {
            const stub = await getAgentByName<Env, SmartCodeGeneratorAgent>(env.CodeGenObject, agentId, {
                locationHint: 'enam',
                jurisdiction: jurisdiction,
            });
            const isInitialized = await stub.isInitialized()
            if (isInitialized) {
                return stub
            }
        }
        // If all jurisdictions fail, throw an error
        throw new Error(`Agent ${agentId} not found in any jurisdiction`);
    }
    return getAgentByName<Env, SmartCodeGeneratorAgent>(env.CodeGenObject, agentId, {
        locationHint: 'enam'
    });
}

export async function getAgentState(env: Env, agentId: string) : Promise<CodeGenState> {
    const agentInstance = await getAgentStub(env, agentId);
    return agentInstance.getState() as CodeGenState;
}

export async function cloneAgent(env: Env, agentId: string) : Promise<DurableObjectStub<SmartCodeGeneratorAgent>> {
    const agentInstance = await getAgentStub(env, agentId, true);
    const newAgentId = generateId();

    const newAgent = await getAgentStub(env, newAgentId);
    const originalState = agentInstance.getState() as CodeGenState;
    const newState = {
        ...originalState,
        sessionId: newAgentId,
        sandboxInstanceId: undefined,
        previewURL: undefined,
        tunnelURL: undefined,
        pendingUserInputs: [],
        currentDevState: 0,
        generationPromise: undefined,
        shouldBeGenerating: false,
        latestScreenshot: undefined,
        clientReportedErrors: [],
    };

    await newAgent.setState(newState);
    return newAgent;
}

