import { DurableObject, env } from "cloudflare:workers";

export interface RateLimitState {
  requests: number[];
  blacklistedModels: string[];
}

interface RequestBody {
  model?: string;
  [key: string]: unknown;
}

export class RateLimiter extends DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    super(state, env);
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    const sessionId = pathname.split('/').pop();

    if (!sessionId) {
      return new Response("Session ID required", { status: 400 });
    }

    if (request.method === "POST" && pathname.endsWith("/check")) {
      return this.checkRateLimit(sessionId, request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async checkRateLimit(sessionId: string, request: Request): Promise<Response> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Get current state
    const currentState = await this.state.storage.get<RateLimitState>(`session:${sessionId}`) || {
      requests: [],
      blacklistedModels: ["gpt-4-turbo-preview", "dall-e-3"] // Default blacklist
    };

    // Filter out requests older than 1 minute
    currentState.requests = currentState.requests.filter(timestamp => timestamp > oneMinuteAgo);

    // Check if rate limit exceeded
    if (currentState.requests.length >= 10) {
      return new Response(JSON.stringify({
        allowed: false,
        error: "Rate limit exceeded: 10 requests per minute"
      }), { 
        status: 429,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check model blacklist if request body contains model
    try {
      const body = await request.json() as RequestBody;
      if (body.model && currentState.blacklistedModels.some(model => 
        body.model!.toLowerCase().includes(model.toLowerCase())
      )) {
        return new Response(JSON.stringify({
          allowed: false,
          error: `Model '${body.model}' is not allowed`
        }), { 
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
    } catch {
      // Ignore JSON parsing errors
    }

    // Add current request timestamp
    currentState.requests.push(now);

    // Save updated state
    await this.state.storage.put(`session:${sessionId}`, currentState);

    return new Response(JSON.stringify({
      allowed: true,
      remainingRequests: 10 - currentState.requests.length
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }
}