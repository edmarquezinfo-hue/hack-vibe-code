import { fromHono } from "chanfana";
import { Hono } from "hono";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";
import { OpenAIProxy } from "./endpoints/openaiProxy";
import { RateLimiter } from "./rateLimiter";
import { authMiddleware, authLoggingMiddleware } from "./middleware/auth";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Apply auth logging middleware to all routes
app.use("*", authLoggingMiddleware);

// Apply authentication middleware to protected endpoints
app.use("/api/tasks/*", authMiddleware);
app.use("/api/openai/*", authMiddleware);

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);

// Register OpenAI proxy endpoint for all HTTP methods
openapi.all("/api/openai/*", OpenAIProxy);

// You may also register routes for non OpenAPI directly on Hono
// app.get('/test', (c) => c.text('Hono!'))

// Export the Hono app and Durable Object classes
export default app;
export { RateLimiter };
