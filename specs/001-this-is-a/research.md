# Phase 0 Research — Multi-role Telegram Journaling Assistant

## Decision Log

### 1. Prisma-Governed Catalogue Metadata & DDL

- **Decision**: Use Prisma as the authoritative migration tool for core catalogue metadata tables while executing additive DDL for dynamic journal tables through `PrismaClient.$executeRaw` inside a hardened `catalogueSchemaTool`.
- **Rationale**: Aligns with the requirement that migrations/CRUD flow through Prisma, keeps schema history in `prisma/migrations`, and still allows controlled runtime table/column creation derived from admin instructions.
- **Alternatives Considered**:
  - **Direct node-postgres client**: Violates the Prisma-first directive and duplicates connection management.
  - **`prisma migrate dev` on every admin change**: Too slow and unsafe for runtime operations; raw DDL within a managed tool is faster while preserving Prisma models for metadata tables.

### 2. Dual-Mastra Agent Composition

- **Decision**: Maintain two Mastra agents—`adminCatalogueAgent` for configuration parsing and `journalUserAgent` for journaling conversations—coordinated by shared workflows for reminders, analytics, and document responses.
- **Rationale**: Mirrors the Telegram bot split (admin vs. user), keeps prompts focused, and enables targeted tool exposure (schema vs. journal writer) without overloading a single agent.
- **Alternatives Considered**:
  - **Unified agent**: Higher risk of tool misuse and token bloat.
  - **Per-domain micro-agents**: Adds orchestration overhead without material benefit for MVP scope.

### 3. Schema Inference Guard Rails

- **Decision**: Parse admin text with structured outputs (Anthropic function calling) validated by Zod, map inferred field types to Prisma-compatible Postgres types, and require human-friendly field labels plus snake_case column names before executing DDL.
- **Rationale**: Prevents unsafe column creation, satisfies readability requirements, and ensures new columns comply with Prisma expectations (numeric/text/datetime/etc.).
- **Alternatives Considered**:
  - **Free-form prompt-to-SQL**: Too error-prone and violates Security by Design.
  - **Manual admin UI**: Out of scope for current Telegram-first workflow.

### 4. Journal Writer Persistence Strategy

- **Decision**: The `journalWriterTool` uses Prisma transactions to lookup catalogue metadata, resolve target table names, and insert parsed values with consent checks; missing mandatory fields trigger follow-up prompts instead of partial inserts.
- **Rationale**: Keeps CRUD within Prisma, centralises validation logic, and allows reuse for analytics queries.
- **Alternatives Considered**:
  - **Direct SQL via `pg`**: Breaks Prisma-only requirement.
  - **JSON shadow table**: Loses per-field queryability demanded by analytics.

### 5. Document Ingestion & Retrieval

- **Decision**: Store encrypted originals on disk, persist metadata via Prisma models, and push embeddings to a Prisma-managed `document_embeddings` table with `pgvector` support; retrieval uses cosine similarity queries with guardrailed citations.
- **Rationale**: Reuses existing Ollama integration, keeps compliance posture (filesystem encryption + DB audit), and avoids introducing an external vector service.
- **Alternatives Considered**:
  - **Cloud object storage**: Deferred until deployment environment is fixed.
  - **Third-party vector DB**: Adds ops burden with limited MVP gain.

### 6. Reminder Scheduling & Compliance Logging

- **Decision**: Run a dedicated reminder scheduler service that reads Prisma-stored schedules, dispatches Telegram prompts, and logs results plus schema changes into an immutable `audit_events` table.
- **Rationale**: Satisfies HIPAA/GDPR traceability, ensures reminder SLAs (<5 minutes), and centralises compliance reporting.
- **Alternatives Considered**:
  - **Crontab + ad hoc logging**: Hard to audit and scale.
  - **Third-party scheduler**: Adds latency and dependence on external infra before necessity is proven.

## Outstanding Questions

_No outstanding questions. All Phase 0 unknowns resolved._
