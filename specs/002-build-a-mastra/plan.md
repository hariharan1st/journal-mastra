# Implementation Plan: Dynamic Configuration-Driven Mastra Agent

**Branch**: `002-build-a-mastra` | **Date**: 2025-10-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/agent/code/journal-mastra/specs/002-build-a-mastra/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, manual-validation.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code, or `AGENTS.md` for all other agents).
7. Re-evaluate Constitution Check section with emphasis on modularity, reuse, readability, security, and scalability expectations
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
   → Include how manual validation evidence will be produced when automated tests are not planned
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

Build a dynamic configuration-driven Mastra agent system that automatically generates MCP tools based on schema configurations. The system accepts Zod-based configuration defining database tables, fields, and validation rules, then dynamically creates tools for LLM agents to validate and persist data. Uses existing Mastra AI framework, PostgreSQL with Prisma ORM, and Zod for validation. Leverages established patterns from catalogue-schema-tool and dynamic-table-manager for schema-driven tool generation and database operations.

## Technical Context

**Language/Version**: TypeScript 5.9 on Node.js 20.9  
**Primary Dependencies**: `@mastra/core`, `@mastra/memory`, `@mastra/loggers`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`, `zod`, `@prisma/client`, `prisma`, `pg`, `pgvector`  
**Storage**: PostgreSQL 15+ with pgvector extension, Prisma ORM for migrations and queries  
**Validation Approach**: Contract testing for tool interfaces, manual validation walkthrough for end-to-end flows, Zod schema validation at runtime  
**Target Platform**: Linux server (Node.js runtime)  
**Project Type**: Single TypeScript service with Mastra agent framework  
**Performance Goals**: Sub-200ms tool execution for simple validations, handle 100+ concurrent tool invocations  
**Constraints**: Maintain Prisma transaction safety, preserve existing audit trail patterns, reuse dynamic-table-manager patterns  
**Scale/Scope**: Support 10-20 dynamic table configurations initially, extensible to 100+ tables

**Implementation Details from User**:

- Use Mastra AI framework (documentation available via MCP server)
- PostgreSQL with Prisma ORM for all database operations
- Zod for schema validation and runtime type checking
- Create dynamic tools based on configuration input
- Tool execution validates data via Zod then persists via Prisma
- Leverage existing patterns: `catalogue-schema-tool.ts` for schema parsing, `dynamic-table-manager.ts` for table operations

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### I. Modular Architecture Mandate

✅ **PASS**: New dynamic tool generator will be a standalone module with single responsibility (configuration → tool generation). Reuses existing `dynamic-table-manager` for DB operations, maintains clear separation of concerns.

### II. Reusable Building Blocks First

✅ **PASS**: Leverages existing utilities:

- `dynamic-table-manager.ts` for table schema operations
- `catalogue-schema-parser.ts` patterns for Zod schema parsing
- `prisma-client.ts` for database connections
- Creates generic configuration parser reusable for multiple tool types

### III. Readable Code Standard

✅ **PASS**: Will follow existing codebase patterns with:

- Explicit type definitions via Zod schemas
- Inline documentation for configuration structure
- Small, focused functions for schema parsing, tool generation, validation
- Contract tests to document expected behavior

### IV. Security by Design

✅ **PASS**: Security measures include:

- All configuration inputs validated via Zod before processing
- SQL injection prevented via Prisma parameterized queries
- No raw SQL execution from configuration
- Configuration schema enforces safe column/table naming patterns
- Audit trail maintained for all data mutations

### V. Scalable Efficiency Focus

✅ **PASS**: Performance considerations:

- Tool generation cached after initial configuration parse
- Prisma connection pooling for concurrent tool invocations
- Lazy tool registration to avoid startup overhead
- Validation schemas compiled once, reused for all invocations
- Database operations batched where possible

**Initial Assessment**: No constitutional violations. Design aligns with modular, reusable, secure patterns established in existing codebase.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md               # This file (/plan command output)
├── research.md           # Phase 0 output (/plan command)
├── data-model.md         # Phase 1 output (/plan command)
├── quickstart.md         # Phase 1 output (/plan command)
├── manual-validation.md  # Phase 1 output (evidence plan)
├── contracts/            # Phase 1 output (/plan command, optional)
└── tasks.md              # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
src/
└── mastra/
    ├── agents/
    │   └── dynamic-config-agent.ts          # NEW: Agent with dynamic tools
    ├── lib/
    │   ├── parsing/
    │   │   ├── catalogue-schema-parser.ts   # EXISTING: Reference pattern
    │   │   └── tool-config-parser.ts        # NEW: Generic config parser
    │   ├── prisma-client.ts                 # EXISTING: Reused
    │   └── logging.ts                       # EXISTING: Reused
    ├── services/
    │   ├── dynamic-table-manager.ts         # EXISTING: Reused for DDL
    │   └── dynamic-tool-generator.ts        # NEW: Tool factory service
    ├── tools/
    │   ├── catalogue-schema-tool.ts         # EXISTING: Reference pattern
    │   └── [generated-tools]                # RUNTIME: Tools created dynamically
    └── index.ts                             # MODIFIED: Export new modules

tests/
├── contracts/
│   └── dynamic-tool.contract.test.ts        # NEW: Tool contract tests
├── lib/
│   └── tool-config-parser.test.ts           # NEW: Parser tests
└── services/
    └── dynamic-tool-generator.test.ts       # NEW: Generator tests

specs/002-build-a-mastra/
├── plan.md                                   # This file
├── research.md                               # Phase 0 output
├── data-model.md                             # Phase 1 output
├── quickstart.md                             # Phase 1 output
├── manual-validation.md                      # Phase 1 output
└── contracts/                                # Phase 1 output
    ├── tool-config-schema-contract.md
    └── dynamic-tool-execution-contract.md
```

**Structure Decision**: Single TypeScript service architecture following existing `src/mastra/` organization. New modules placed under `lib/parsing/` (configuration parsing), `services/` (tool generation logic), and `agents/` (agent orchestration). Follows established patterns from catalogue-schema-tool for consistency. Tests mirror source structure under `tests/` with contract, lib, and service subdirectories.

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements (optional when external interfaces exist):
   - For each user action → endpoint or workflow contract
   - Capture request/response shapes with TypeScript types or schemas
   - Store outputs in `/contracts/` when interfaces need versioning

3. **Map module responsibilities & reuse plan**:
   - Document existing utilities to leverage before adding new code
   - Specify boundaries for new modules and how they interact
   - Note any debt created by reusing legacy patterns (justify in Constitution Check)

4. **Design manual validation approach**:
   - Describe step-by-step validation flows in `manual-validation.md`
   - Include expected inputs/outputs, samples, and security/performance checks
   - Highlight any tooling or scripts that need to be prepared for validation sessions

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh copilot`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\* (if applicable), quickstart.md, manual-validation.md, agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during /plan_

**Task Generation Strategy**:

The /tasks command will load `.specify/templates/tasks-template.md` and generate implementation tasks based on Phase 1 design artifacts:

1. **From research.md**: Identify technical decisions requiring implementation
   - Configuration parser module (Zod schemas)
   - Dynamic tool generator service (Mastra tool factory)
   - Type mapping utilities (FieldConfig → Zod schema)
   - Error formatting utilities (Zod errors → LLM-friendly messages)

2. **From data-model.md**: Generate tasks for each entity
   - ToolConfiguration schema implementation → Zod schema task
   - TableConfig schema implementation → Zod schema task
   - FieldConfig discriminated union → Zod schema task
   - ToolExecutionResult types → TypeScript definitions task

3. **From contracts/**: Generate implementation and validation tasks
   - tool-config-schema-contract.md → Parser implementation task [P] + Contract test task
   - dynamic-tool-execution-contract.md → Tool generator implementation task [P] + Contract test task

4. **From quickstart.md**: Generate example and documentation tasks
   - Example configuration files → Sample config creation task [P]
   - Agent integration example → Example agent implementation task

5. **From manual-validation.md**: Generate validation evidence tasks
   - For each scenario (1-10) → Evidence capture task with specific test steps
   - Performance benchmarking → Separate task with metrics collection
   - Integration testing → Agent walkthrough task

**Ordering Strategy**:

1. **Foundation Layer** (Tasks 1-4):
   - Zod schema definitions for all configuration entities [P]
   - Configuration parser with validation [P]
   - Type mapping utilities [P]
   - Error formatting utilities [P]

2. **Core Service Layer** (Tasks 5-7):
   - Dynamic tool generator service (depends on schemas) [P]
   - Tool execution wrapper (database + validation) [P]
   - Column mapping logic [P]

3. **Integration Layer** (Tasks 8-10):
   - Example agent with generated tools
   - Agent registration utilities
   - End-to-end integration

4. **Testing Layer** (Tasks 11-16):
   - Contract tests for configuration schema [P]
   - Contract tests for tool execution [P]
   - Unit tests for parser [P]
   - Unit tests for generator [P]
   - Unit tests for type mappers [P]
   - Integration tests for agent

5. **Validation & Documentation** (Tasks 17-20):
   - Manual validation scenario execution (scenarios 1-7)
   - Performance benchmarking (scenarios 8-9)
   - Agent integration walkthrough (scenario 10)
   - Evidence documentation and sign-off

**Estimated Output**: 18-22 numbered, ordered tasks in tasks.md

**Dependencies**:

- Existing modules: `prisma-client.ts`, `logging.ts`, `dynamic-table-manager.ts`
- Prisma schema must have target tables defined or DynamicTableManager used
- Mastra agent framework already available

**Parallel Execution Opportunities**:

- [P] markers indicate tasks on independent files/modules that can be executed in parallel
- Foundation layer tasks (1-4) are independent
- Contract test tasks (11-12) independent from integration tests (16)
- Manual validation scenarios can be split among testers

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (execute quickstart.md, capture manual validation evidence, spot-check performance)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

**No violations detected.** The design aligns with all constitutional principles:

- Modular architecture maintained with clear separation of concerns
- Leverages existing building blocks (DynamicTableManager, catalogue-schema-parser patterns)
- Code will follow readable standards with Zod schemas and TypeScript types
- Security measures integrated (validation, parameterized queries, whitelisting)
- Performance targets defined and achievable with caching strategy

No complexity deviations to document.

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Manual validation plan documented
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented (N/A - no deviations)

**Artifacts Generated**:

- [x] `/home/agent/code/journal-mastra/specs/002-build-a-mastra/research.md`
- [x] `/home/agent/code/journal-mastra/specs/002-build-a-mastra/data-model.md`
- [x] `/home/agent/code/journal-mastra/specs/002-build-a-mastra/contracts/tool-config-schema-contract.md`
- [x] `/home/agent/code/journal-mastra/specs/002-build-a-mastra/contracts/dynamic-tool-execution-contract.md`
- [x] `/home/agent/code/journal-mastra/specs/002-build-a-mastra/quickstart.md`
- [x] `/home/agent/code/journal-mastra/specs/002-build-a-mastra/manual-validation.md`
- [x] `/home/agent/code/journal-mastra/.github/copilot-instructions.md` (updated)

---

_Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`_
