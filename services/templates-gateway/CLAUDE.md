# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Workers API built with Hono and chanfana that provides OpenAPI 3.1 compliant endpoints for task management. The project automatically generates OpenAPI schema from TypeScript code and validates incoming requests.

## Architecture

- **Framework**: Hono with chanfana for OpenAPI support
- **Runtime**: Cloudflare Workers
- **Validation**: Zod schemas for type-safe request/response validation
- **Type Safety**: Full TypeScript with strict configuration

### Key Files
- `src/index.ts`: Main router with OpenAPI registry and endpoint registration
- `src/types.ts`: Shared TypeScript types and Zod schemas (Task model, AppContext)
- `src/endpoints/`: Individual endpoint implementations extending OpenAPIRoute
- `wrangler.jsonc`: Cloudflare Workers configuration

### Endpoint Pattern
All endpoints extend `OpenAPIRoute` from chanfana and follow this pattern:
- Define OpenAPI schema with request/response validation
- Implement `handle(c: AppContext)` method
- Use `getValidatedData()` for type-safe request parsing

## Development Commands

```bash
# Start local development server with hot reload
npm run dev
# or
wrangler dev

# Deploy to Cloudflare Workers
npm run deploy
# or  
wrangler deploy

# Generate TypeScript types from Wrangler
npm run cf-typegen
# or
wrangler types
```

## Development Workflow

1. Local development: `npm run dev` starts server at `http://localhost:8787/`
2. Swagger UI available at root URL (`/`) for testing endpoints
3. Hot reload enabled - changes in `src/` trigger automatic server reload
4. API endpoints follow REST pattern: `/api/tasks` with CRUD operations

## Project Structure Notes

- Endpoints are organized by functionality in `src/endpoints/`
- Each endpoint is a separate class extending OpenAPIRoute
- Types and schemas centralized in `src/types.ts`
- Uses Zod for runtime validation and chanfana helpers (Str, DateTime, Bool)
- Main router registers all endpoints with OpenAPI documentation