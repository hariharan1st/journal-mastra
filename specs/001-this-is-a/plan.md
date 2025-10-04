# Implementation Plan: Multi-role Telegram Journaling Assistant

**Branch**: `[001-this-is-a]` | **Date**: 2025-10-04 | **Spec**: `/specs/001-this-is-a/spec.md`
**Input**: Feature specification from `/specs/001-this-is-a/spec.md`

## Execution Flow (/plan command scope)

1. Load feature spec from Input path — ✅ Completed
2. Fill Technical Context (scan for NEEDS CLARIFICATION) — ✅ Completed
3. Fill the Constitution Check section based on the constitution document — ✅ Completed
4. Evaluate Constitution Check section and log outcomes — ✅ Completed (Initial Constitution Check: PASS)
5. Execute Phase 0 → `research.md` — ✅ Completed
6. Execute Phase 1 → `contracts/`, `data-model.md`, `quickstart.md`, `manual-validation.md`, agent context — ✅ Completed
7. Re-evaluate Constitution Check after design — ✅ Completed (Post-Design Check: PASS)
8. Plan Phase 2 → Describe task generation approach (do not create `tasks.md`) — ✅ Documented below
9. Stop — ready for `/tasks`

## Summary

Admin caregivers author natural-language catalogues via the Telegram configuration bot; the admin Mastra agent parses those instructions, validates them with Zod, and invokes Prisma-backed tools to version catalogue metadata, create or evolve Postgres tables, and register reminder rules. A separate journaling agent interprets user conversations, maps them onto the active catalogue, and persists structured entries while powering summaries, healthy-vs-unhealthy analytics, compliance logging, and document-grounded answers.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 20.9  
**Primary Dependencies**: `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client` + `prisma`, `pg`, `pgvector`  
**Storage**: PostgreSQL 15 (primary + embeddings) with Prisma migrations, encrypted filesystem for document originals  
**Validation Approach**: Manual evidence per `manual-validation.md`, SQL spot-checks, and Telegram transcript capture  
**Target Platform**: Linux-hosted Mastra service with dual Telegram bots (admin + user)  
**Project Type**: Single-service backend (Mastra orchestration + Prisma data layer)  
**Performance Goals**: Reminder delivery under 5 minutes of schedule, journal ingestion <1s p95, availability ≥99.5%  
**Constraints**: HIPAA + GDPR compliance, additive schema evolution only, Prisma-managed migrations/CRUD, encrypted-at-rest docs  
**Scale/Scope**: Launch assumptions ~500 concurrently active users sharing one global catalogue (scalable to thousands with horizontal bot workers)

## Constitution Check

- **Modular Architecture Mandate**: Admin and user agents, schema orchestration, reminder scheduler, and compliance auditing ship as isolated modules with contracts; shared Prisma client lives in `src/mastra/lib`. ✅
- **Reusable Building Blocks First**: Existing Mastra abstractions for agents/workflows are reused; Prisma client, Zod validators, and audit helpers are shared across tools. ✅
- **Readable Code Standard**: Plan mandates typed contracts, descriptive module naming, and inline rationale for schema inference logic. ✅
- **Security by Design**: All tool inputs validated with Zod, Prisma executes parametrised queries, audit trail + RLS considerations captured. ✅
- **Scalable Efficiency Focus**: Reminder scheduler batches Prisma writes, embeddings reuse pgvector indices, and dynamic tables avoid per-request migrations. ✅

**Gate Result**: PASS (Initial & Post-Design Constitution Checks complete)

## Project Structure

### Documentation (feature artifacts)

```
specs/001-this-is-a/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── manual-validation.md
└── contracts/
    ├── admin-catalogue-contract.md
    └── journal-writer-contract.md
```

### Source Code Additions

```
prisma/
└── schema.prisma                # Prisma models for catalogue metadata, reminders, audit logs

src/
└── mastra/
    ├── agents/
    │   ├── admin-catalogue-agent.ts    # Telegram config bot agent
    │   └── journal-user-agent.ts       # User journaling agent
    ├── tools/
    │   ├── catalogue-schema-tool.ts    # Prisma-powered DDL executor
    │   ├── journal-writer-tool.ts      # Handles parsed journal inserts
    │   └── document-ingest-tool.ts     # Upload + embedding workflow hook
    ├── workflows/
    │   ├── catalogue-sync-workflow.ts  # Coordinates rule-set versioning + reminders
    │   └── journal-insights-workflow.ts# Summaries & healthy week analysis
    ├── lib/
    │   ├── prisma-client.ts            # Shared Prisma client factory & telemetry hooks
    │   ├── parsing/
    │   │   ├── catalogue-schema-parser.ts
    │   │   └── journal-message-parser.ts
    │   └── compliance/
    │       └── audit-logger.ts
    └── services/
        ├── reminder-scheduler.ts       # Interval scheduling + escalation handling
        └── retention-runner.ts         # HIPAA/GDPR retention enforcement

docs/
└── validations/
    └── 001-this-is-a/                  # Manual validation evidence bundle
```

**Structure Decision**: Single Mastra backend with Prisma-governed Postgres. Shared libraries live under `src/mastra/lib`; agents/tools/workflows align with existing repo conventions to preserve modularity and reuse.

## Phase 0: Outline & Research

- Resolved dynamic schema orchestration with Prisma raw DDL executed through a controlled tool wrapper (see `research.md`, Decision 1).
- Selected dual-agent composition with shared workflows for reminders, analytics, and document retrieval (Decision 2).
- Documented guard rails for LLM-to-DDL translation, compliance logging, and document embedding strategy (Decisions 3-5).
- All unknowns from Technical Context cleared; no outstanding clarifications remain.

**Output**: `/home/agent/code/journal-mastra/specs/001-this-is-a/research.md`

## Phase 1: Design & Contracts

- `data-model.md` captures Prisma models for catalogue metadata, reminder rules, dynamic journal tables, documents, embeddings, and audit events, including governance for additive schema evolution.
- Contracts define the admin catalogue schema tool and journal writer tool interface, ensuring Mastra agents call typed tool functions.
- `quickstart.md` details prerequisites, Prisma setup (`npm install`, `prisma generate`, `prisma migrate`), and dev workflow for Telegram bots.
- `manual-validation.md` enumerates seven evidence flows covering catalogue publishing, journal writes, reminders, analytics, document Q&A, and compliance checks.
- Constitution re-check confirmed modularity, reuse, readability, security, and scalability expectations are upheld post-design.

**Output Paths**:

- `/home/agent/code/journal-mastra/specs/001-this-is-a/data-model.md`
- `/home/agent/code/journal-mastra/specs/001-this-is-a/quickstart.md`
- `/home/agent/code/journal-mastra/specs/001-this-is-a/manual-validation.md`
- `/home/agent/code/journal-mastra/specs/001-this-is-a/contracts/`

## Phase 2: Task Planning Approach

- Seed tasks from design docs: Prisma schema creation, Mastra agent scaffolding, schema inference utilities, reminder scheduler, document ingestion pipeline, audit logging, and manual validation prep.
- Prioritise groundwork (Prisma schema, migrations, shared client) before integrating agents/tools/workflows.
- Annotate parallelisable tasks (`[P]`) for independent modules (e.g., document ingestion vs. reminder scheduler).
- Include compliance hardening (RLS policies, audit log verification) and evidence capture tasks drawn from `manual-validation.md`.
- Expected output: 18–24 ordered tasks in `tasks.md` when `/tasks` is executed.

## Phase 3+: Future Implementation

- **Phase 3**: `/tasks` command to materialise task list.
- **Phase 4**: Implement tasks respecting constitutional guardrails.
- **Phase 5**: Execute manual validation flows, capture evidence, and prepare launch sign-off package.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| _None_    | –          | –                                    |

## Progress Tracking

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [ ] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Manual validation plan documented
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

_Based on Constitution v1.0.0 — see `/specify/memory/constitution.md`_

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented (n/a)
