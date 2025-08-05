import { OpenAPIRoute } from "chanfana";
import type { AppContext } from "../types";

export class OpenAIProxy extends OpenAPIRoute {
  schema = {
    tags: ["OpenAI Proxy"],
    summary: "Proxy requests to OpenAI API with rate limiting",
    responses: {
      200: {
        description: "Successful proxy response"
      },
      400: {
        description: "Missing cf-aig-metadata header"
      },
      429: {
        description: "Rate limit exceeded"
      },
      403: {
        description: "Model blacklisted"
      }
    }
  };

  async handle(c: AppContext) {
    // Check for required header
    const sessionId = c.req.header("cf-aig-metadata") || "default";
    // if (!sessionId) {
    //   return c.json({ error: "Missing cf-aig-metadata header with sessionId" }, 400);
    // }

    // Get the path after /api/openai/
    const url = new URL(c.req.url);
    const proxyPath = url.pathname.replace("/api/openai", "");

    console.log("sessionId", sessionId, "proxyPath", proxyPath, "URL", url);
    
    
    // Check rate limit using Durable Object
    const rateLimiterId = c.env.RATE_LIMITER.idFromName(sessionId);
    const rateLimiterStub = c.env.RATE_LIMITER.get(rateLimiterId);
    
    // Create a new request for rate limit check
    let requestBody = undefined;
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      try {
        requestBody = await c.req.raw.clone().text();
      } catch (error) {
        // Handle cases where body is not readable
        requestBody = undefined;
      }
    }
    
    const rateLimitRequest = new Request(`https://dummy.com/${sessionId}/check`, {
      method: "POST",
      body: requestBody,
      headers: { "Content-Type": "application/json" }
    });

    const rateLimitResponse = await rateLimiterStub.fetch(rateLimitRequest);
    const rateLimitResult = await rateLimitResponse.json() as { allowed: boolean; error?: string };

    if (!rateLimitResult.allowed) {
      const statusCode = rateLimitResponse.status;
      if (statusCode === 429) {
        return c.json({ error: rateLimitResult.error }, 429);
      } else if (statusCode === 403) {
        return c.json({ error: rateLimitResult.error }, 403);
      } else {
        return c.json({ error: rateLimitResult.error }, 400);
      }
    }

    // Construct the target URL
    const baseUrl = c.env.CF_AI_BASE_URL;
    if (!baseUrl) {
      return c.json({ error: "CF_AI_BASE_URL not configured" }, 500);
    }

    const targetUrl = `${baseUrl}${proxyPath}${url.search}`;

    // Prepare headers for the proxy request
    const proxyHeaders = new Headers();
    
    // Copy all headers except host and cf-aig-metadata
    for (const [key, value] of c.req.raw.headers) {
      if (key.toLowerCase() !== "host" && key.toLowerCase() !== "cf-aig-metadata") {
        proxyHeaders.set(key, value);
      }
    }

    // Add authorization header
    const apiKey = c.env.CF_AI_API_KEY;
    if (apiKey) {
      proxyHeaders.set("Authorization", `Bearer ${apiKey}`);
    }

    // Make the proxy request
    try {
      const proxyRequest = new Request(targetUrl, {
        method: c.req.method,
        headers: proxyHeaders,
        body: c.req.method !== "GET" && c.req.method !== "HEAD" ? c.req.raw.body : undefined
      });

      console.log("proxyRequest", proxyRequest, "proxyHeaders", proxyHeaders, "c.req.raw", c.req.raw);
      
      const response = await fetch(proxyRequest);
      
      // Create response with same status and headers, but ensure proper content handling
      const responseHeaders = new Headers();
      for (const [key, value] of response.headers) {
        // Skip content-encoding headers to avoid compression issues
        if (key.toLowerCase() !== "content-encoding") {
          responseHeaders.set(key, value);
        }
      }

      console.log("response status:", response.status, "headers:", Array.from(response.headers.entries()));
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (error) {
      console.log("error", error);
      
      return c.json({ 
        error: "Failed to proxy request", 
        details: error instanceof Error ? error.message : String(error)
      }, 500);
    }
  }
}
// */