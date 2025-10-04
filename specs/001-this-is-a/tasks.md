# Tasks: Multi-role Telegram Journaling Assistant

**Input**: Design documents from `/specs/001-this-is-a/`
**Prerequisites**: `plan.md`, `research.md`, `data-model.md`, `contracts/`

## Task List

- [x] T001 Update `package.json` to add Prisma/PostgreSQL dependencies (`@prisma/client`, `prisma`, `pg`, `pgvector`) and npm scripts for `prisma generate`, `prisma migrate`, and test runner bootstrap. _(Depends on: none)_
- [x] T002 Initialize Prisma scaffolding by creating `prisma/schema.prisma` with Postgres datasource, client generator, and `@@include` statements for modular models. Implement all the modular models as well. _(Depends on: T001)_
- [ ] T003 Create shared Prisma client factory with telemetry hooks in `src/mastra/lib/prisma-client.ts` (plus barrel export if needed) loading connection settings from the environment. _(Depends on: T002)_
- [ ] T004 [P] Define `admin_rule_sets` Prisma model, indexes, and publication status enum in `prisma/models/admin_rule_sets.prisma`. _(Depends on: T002)_
- [ ] T005 [P] Define `tracking_catalogue_items` Prisma model with unique slug constraint in `prisma/models/tracking_catalogue_items.prisma`. _(Depends on: T002)_
- [ ] T006 [P] Define `tracking_catalogue_fields` Prisma model with enum metadata in `prisma/models/tracking_catalogue_fields.prisma`. _(Depends on: T005)_
- [ ] T007 [P] Define `journal_entry_tables` Prisma model and schema version tracking in `prisma/models/journal_entry_tables.prisma`. _(Depends on: T004, T005)_
- [ ] T008 [P] Author dynamic journal base table SQL template (`prisma/sql/journal_base_table.sql`) capturing shared columns and foreign keys for runtime DDL. _(Depends on: T003, T007)_
- [ ] T009 [P] Define `user_profiles` Prisma model with consent status enum in `prisma/models/user_profiles.prisma`. _(Depends on: T002)_
- [ ] T010 [P] Define `caregiver_profiles` Prisma model in `prisma/models/caregiver_profiles.prisma`. _(Depends on: T002)_
- [ ] T011 [P] Define `reminder_rules` Prisma model with schedule and escalation fields in `prisma/models/reminder_rules.prisma`. _(Depends on: T005)_
- [ ] T012 [P] Define `reminder_dispatches` Prisma model with delivery status enum in `prisma/models/reminder_dispatches.prisma`. _(Depends on: T011)_
- [ ] T013 [P] Define `documents` Prisma model for encrypted storage metadata in `prisma/models/documents.prisma`. _(Depends on: T002)_
- [ ] T014 [P] Define `document_embeddings` Prisma model with pgvector type in `prisma/models/document_embeddings.prisma`. _(Depends on: T013)_
- [ ] T015 [P] Define `audit_events` Prisma model with composite index in `prisma/models/audit_events.prisma`. _(Depends on: T004)_
- [ ] T016 [P] Write contract tests for `catalogueSchemaTool` covering create/alter/no-change flows in `tests/contracts/catalogue-schema-tool.contract.test.ts`. _(Depends on: T004-T015)_
- [ ] T017 [P] Write contract tests for `journalWriterTool` covering consent gating and follow-up prompts in `tests/contracts/journal-writer-tool.contract.test.ts`. _(Depends on: T004-T015)_
- [ ] T018 [P] Write parser unit tests validating admin text extraction in `tests/lib/catalogue-schema-parser.test.ts`. _(Depends on: T004-T015)_
- [ ] T019 Implement Zod-backed parser and DTO builders in `src/mastra/lib/parsing/catalogue-schema-parser.ts`, exporting typed helpers for tools. _(Depends on: T018)_
- [ ] T020 [P] Write dynamic table manager tests for runtime DDL in `tests/services/dynamic-table-manager.test.ts`. _(Depends on: T004-T015, T008)_
- [ ] T021 Implement dynamic table manager service in `src/mastra/services/dynamic-table-manager.ts` executing additive DDL and audit writes. _(Depends on: T020, T008)_
- [ ] T022 [P] Write reminder rule synchronization tests in `tests/services/reminder-rule-service.test.ts` for upsert/disable behavior. _(Depends on: T004-T015)_
- [ ] T023 Implement reminder rule synchronization service in `src/mastra/services/reminder-rule-service.ts` coordinating Prisma transactions. _(Depends on: T022)_
- [ ] T024 Implement `catalogueSchemaTool` in `src/mastra/tools/catalogue-schema-tool.ts` wiring parser, dynamic table manager, and reminder service to satisfy the contract. _(Depends on: T016, T021, T023)_
- [ ] T025 [P] Write journal writer integration tests for dynamic table lookups and consent handling in `tests/tools/journal-writer-tool.test.ts`. _(Depends on: T017, T015)_
- [ ] T026 Implement `journalWriterTool` in `src/mastra/tools/journal-writer-tool.ts` to persist entries and return prompts per contract. _(Depends on: T025)_
- [ ] T027 [P] Write admin agent conversation tests asserting tool usage in `tests/agents/admin-catalogue-agent.test.ts`. _(Depends on: T024)_
- [ ] T028 Implement admin Mastra agent in `src/mastra/agents/admin-catalogue-agent.ts` exposing catalogue schema and journal writer tools with Anthropic prompts. _(Depends on: T027)_
- [ ] T029 [P] Write catalogue sync workflow tests in `tests/workflows/catalogue-sync-workflow.test.ts` ensuring rule publication, DDL, and reminders run in order. _(Depends on: T024, T028)_
- [ ] T030 Implement `src/mastra/workflows/catalogue-sync-workflow.ts` orchestrating schema publication, table creation, and reminder updates. _(Depends on: T029)_
- [ ] T031 Update `src/mastra/index.ts` to register the admin agent/workflow, remove weather demo wiring, and ensure LibSQL telemetry coexists with Prisma-backed data. _(Depends on: T028, T030)_
- [ ] T032 [P] Add integration bootstrap script `scripts/dev/create-admin-rule-set.ts` to seed a sample catalogue through the tools. _(Depends on: T026, T031)_
- [ ] T033 [P] Update `specs/001-this-is-a/quickstart.md` with migration steps, seeding command, and admin prompt walkthrough. _(Depends on: T031)_
- [ ] T034 [P] Extend `specs/001-this-is-a/manual-validation.md` with evidence steps for dynamic table creation and reminder updates. _(Depends on: T031)_
- [ ] T035 [P] Document DDL guard rails and audit expectations in `docs/validations/001-this-is-a/catalogue-ddl.md`. _(Depends on: T021)_
- [ ] T036 [P] Add performance and telemetry configuration for DDL/runtime paths in `src/mastra/lib/logging.ts`, wiring logger usage from tools and services. _(Depends on: T021, T023)_

## Parallel Execution Examples

- After completing T002, run model definitions in parallel:
  - `npx specify run --task T004`
  - `npx specify run --task T005`
  - `npx specify run --task T009`

- Once T016 and T020 are finished, execute service implementations concurrently:
  - `npx specify run --task T021`
  - `npx specify run --task T023`

- Following T031, polish tasks can proceed in parallel:
  - `npx specify run --task T032`
  - `npx specify run --task T033`
  - `npx specify run --task T034`

``> ensure dependencies (T001) and Prisma base (T002) are complete before launching any `[P]` group.``
