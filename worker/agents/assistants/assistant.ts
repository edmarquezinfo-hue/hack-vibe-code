// An assistant to agents

import { Message } from "../inferutils/common";

class Assistant<Env> {
    protected history: Message[] = [];
    protected env: Env;
    protected agentId: string;

    constructor(env: Env, agentId: string, systemPrompt?: Message) {
        this.env = env;
        this.agentId = agentId;
        if (systemPrompt) {
            this.history.push(systemPrompt);
        }
    }

    save(messages: Message[]): Message[] {
        this.history.push(...messages);
        return this.history;
    }

    getHistory(): Message[] {
        return this.history;
    }

    clearHistory() {
        this.history = [];
    } 


}

export default Assistant;
