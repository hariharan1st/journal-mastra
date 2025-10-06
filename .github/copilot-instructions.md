# journal-mastra Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-04

## Active Technologies

- TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client` + `prisma`, `pg`, `pgvector` (001-this-is-a)
- PostgreSQL 15 (primary + embeddings) with Prisma migrations, encrypted filesystem for document originals (001-this-is-a)
- TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client`, `prisma`, `pg`, `pgvector` (002-build-a-mastra)
- PostgreSQL 15+ with pgvector extension, Prisma ORM for migrations and queries (002-build-a-mastra)

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

## Key Patterns & Modules

### Dynamic Configuration-Driven Tools (002-build-a-mastra)

**Pattern**: Configuration → Zod Schema → Mastra Tool → Database Operation

**Core Modules**:

- `src/mastra/lib/parsing/tool-config-schema.ts` - Zod schemas for configuration validation
- `src/mastra/lib/parsing/field-type-mapper.ts` - Maps FieldConfig to Zod runtime schemas
- `src/mastra/services/dynamic-tool-generator.ts` - Generates Mastra tools from config
- `src/mastra/services/tool-executor.ts` - Safe database operations with audit logging

**Usage**:

```typescript
import { loadToolConfiguration } from "./lib/parsing/tool-config-parser.js";
import { createDynamicToolGenerator } from "./services/dynamic-tool-generator.js";

const config = loadToolConfiguration(configJson);
const generator = createDynamicToolGenerator();
const tools = await generator.generateTools(config);
```

**Security Notes**:

- All SQL uses parameterized queries via Prisma
- Table names validated against whitelist
- All inputs validated via Zod before database operations
- Audit trail logged for every tool execution

### Catalogue Schema Management (001-this-is-a)

**Pattern**: Admin text → LLM parsing → Schema validation → DDL operations

**Core Modules**:

- `src/mastra/lib/parsing/catalogue-schema-parser.ts` - Parse admin input to structured schema
- `src/mastra/services/dynamic-table-manager.ts` - Safe DDL operations with Prisma
- `src/mastra/tools/catalogue-schema-tool.ts` - Mastra tool for schema updates

## Recent Changes

- 002-build-a-mastra: Added dynamic configuration-driven tool system with Zod validation, field type mapping, and safe database execution
- 002-build-a-mastra: Added TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client`, `prisma`, `pg`, `pgvector`
- 001-this-is-a: Added TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client` + `prisma`, `pg`, `pgvector`

- 001-this-is-a: Added TypeScript 5.9 on Node.js 20.9 + `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `pg`, `pgvector`

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
