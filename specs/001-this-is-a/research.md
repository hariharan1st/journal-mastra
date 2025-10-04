# Phase 0 Research — Multi-role Telegram Journaling Assistant

## Decision Log

### 1. Dynamic Tracking Catalogue Persistence

- **Decision**: Use PostgreSQL as the authoritative store for admin-defined tracking catalogues and per-category journal tables, managed through a schema-orchestration service that issues `CREATE TABLE` / `ALTER TABLE` statements derived from validated admin instructions.
- **Rationale**: PostgreSQL offers transactional DDL, robust JSONB support for metadata, role-based access control, and aligns with the requirement for HIPAA/GDPR compliance via mature auditing extensions. Using direct SQL keeps migrations transparent and auditable.
- **Alternatives Considered**:
  - **LibSQL (existing project default)**: Lacks the compliance features and scalability guarantees required for HIPAA workloads.
  - **ORM-managed schema (Prisma/TypeORM)**: Slower iteration for highly dynamic per-category schemas and adds abstraction overhead when issuing incremental column changes.

### 2. Agent Composition Strategy

- **Decision**: Implement two primary Mastra agents—`adminCatalogueAgent` and `journalInteractionAgent`—backed by a shared workflow that orchestrates reminder scheduling, document ingestion, and query handling via dedicated tools.
- **Rationale**: Splitting admin configuration from user interactions enforces modularity, matches Telegram bot separation, and allows independent instruction sets tuned for catalog authoring vs. journaling conversations.
- **Alternatives Considered**:
  - **Single monolithic agent**: Risks prompt bloat, weaker guardrails, and higher chance of misrouting tool calls.
  - **Per-category specialist agents**: Adds orchestration complexity without clear benefit in the launch scope.

### 3. Tooling for Schema Changes & Data Capture

- **Decision**: Expose a `catalogueSchemaTool` for admin-driven schema adjustments and a `journalWriterTool` for inserting parsed user messages, both implemented as TypeScript functions using a shared Postgres client and Zod validation layers.
- **Rationale**: Tool encapsulation keeps DDL/DML logic deterministic, facilitates auditing, and provides a reusable integration point if future caregivers add automation.
- **Alternatives Considered**:
  - **Direct database access from agent prompts**: Violates security-by-design principle; tool mediation is safer.
  - **External migration service**: Overkill for incremental column adjustments triggered by configuration text.

### 4. Document Ingestion & Retrieval

- **Decision**: Store uploaded files in an encrypted filesystem volume with metadata persisted to Postgres and embeddings generated via the existing Ollama provider, indexed in a `document_embeddings` table for semantic retrieval.
- **Rationale**: Fulfills requirement to retain originals while enabling question answering, and leverages current Ollama integration to avoid new providers.
- **Alternatives Considered**:
  - **Cloud object storage (S3)**: Deferred until deployment strategy is finalized; local filesystem suffices for MVP.
  - **External vector DB**: Adds operational overhead when Postgres + pgvector can satisfy embedding search.

### 5. Compliance & Audit Logging Approach

- **Decision**: Introduce an audit logging middleware that records admin schema changes, reminder dispatches, and data access events into an `audit_events` table with immutable JSONB payloads.
- **Rationale**: Addresses HIPAA/GDPR traceability, supports breach investigations, and reuses Postgres for centralized storage.
- **Alternatives Considered**:
  - **External logging service**: Not necessary initially; increases exposure surface.
  - **Application logs only**: Insufficient for compliance evidence and tamper-proof storage.

## Outstanding Questions

_No outstanding questions. All Phase 0 unknowns resolved._
