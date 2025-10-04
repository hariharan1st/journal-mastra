# journal-mastra Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-04

## Active Technologies
- TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client` + `prisma`, `pg`, `pgvector` (001-this-is-a)
- PostgreSQL 15 (primary + embeddings) with Prisma migrations, encrypted filesystem for document originals (001-this-is-a)

- (001-this-is-a)
- TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `pg`, `pgvector` (001-this-is-a)
- PostgreSQL 15+ (primary data + embeddings), encrypted filesystem for document originals, LibSQL (existing) for Mastra telemetry (001-this-is-a)

## Project Structure

```
src/mastra/              # agents, tools, workflows, models
specs/                   # feature specs, plans, research artifacts
docs/                    # feature guides and validation evidence (planned)
.specify/                # automation scripts & templates
```

## Commands

- `npm run dev` — start Mastra dev server
- `npm run build` — build Mastra project for deployment
- `npm run start` — run compiled Mastra service

## Code Style

: Follow standard conventions

## Recent Changes
- 001-this-is-a: Added TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client` + `prisma`, `pg`, `pgvector`

- 001-this-is-a: Added TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `pg`, `pgvector`
- 001-this-is-a: Documented Mastra agents + Postgres architecture for multi-role journaling assistant

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
