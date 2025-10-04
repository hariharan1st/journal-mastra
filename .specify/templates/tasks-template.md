# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → interface implementation and validation tasks
   → research.md: Extract decisions → setup tasks
   → manual-validation.md: Extract evidence plan → documentation tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Architecture: shared utilities, module scaffolding, reuse alignment
   → Core: models, services, agents, workflows
   → Security & Performance: hardening, profiling, configuration
   → Documentation & Validation: quickstart, manual evidence, knowledge base updates
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Manual validation tasks MUST reference the evidence artifacts they produce
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have implementation and validation coverage?
   → All entities have models?
   → All endpoints implemented?
   → Manual validation evidence captured?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `docs/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`, `docs/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`, `docs/`
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 3.1: Setup

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

## Phase 3.2: Architecture & Reuse Alignment

- [ ] T004 [P] Confirm target module structure matches plan (e.g., `src/mastra/agents/weather/`)
- [ ] T005 [P] Wire shared utilities/configuration for new work (reuse existing helpers where possible)
- [ ] T006 Capture contract types or interfaces to guide implementation (e.g., `src/mastra/models/weather.ts`)

## Phase 3.3: Core Implementation

- [ ] T007 [P] Implement data models/entities defined in data-model.md
- [ ] T008 [P] Build service/agent logic honoring reusable abstractions
- [ ] T009 Implement workflows or tools that orchestrate the new capability
- [ ] T010 Add input validation and error handling consistent with security guidelines

## Phase 3.4: Security & Performance Hardening

- [ ] T011 Review dependency usage and remove unnecessary packages
- [ ] T012 Add security safeguards (sanitization, secrets management)
- [ ] T013 Capture performance considerations (profiling hooks, concurrency notes)
- [ ] T014 Benchmark or reason through critical paths; record findings in docs

## Phase 3.5: Documentation & Validation

- [ ] T015 [P] Update quickstart.md with usage instructions and expected outcomes
- [ ] T016 [P] Record manual validation evidence per manual-validation.md plan (screenshots/logs)
- [ ] T017 Update README or relevant docs with module overview and reuse notes
- [ ] T018 Conduct post-merge follow-up checklist (schedule review, capture learnings)

## Dependencies

- Setup (T001-T003) complete before architecture work (T004-T006)
- Architecture (T004-T006) informs core implementation (T007-T010)
- Security & performance tasks (T011-T014) depend on core implementation readiness
- Documentation & validation (T015-T018) require implementation outputs and recorded findings

## Parallel Example

```
# Launch T004-T006 together:
Task: "Confirm target module structure matches plan (e.g., src/mastra/agents/weather/)"
Task: "Wire shared utilities/configuration for new work"
Task: "Capture contract types or interfaces to guide implementation"
```

## Notes

- [P] tasks = different files, no dependencies
- Keep tasks small and purpose-driven to preserve readability
- Commit after each task with clear description of modular changes
- Manual validation evidence MUST reference artifacts stored under `docs/` or linked in PR
- Avoid: vague tasks, same file conflicts

## Task Generation Rules

_Applied during main() execution_

1. **From Contracts**:
   - Each contract file → interface implementation task [P]
   - Each endpoint/workflow → manual validation step in documentation
2. **From Data Model**:
   - Each entity → model creation or refinement task [P]
   - Relationships → service/tool orchestration tasks
3. **From User Stories**:
   - Each story → quickstart walkthrough update
   - Edge cases → security/performance hardening tasks

4. **Ordering**:
   - Setup → Architecture → Core Implementation → Security & Performance → Documentation & Validation
   - Dependencies block parallel execution

## Validation Checklist

_GATE: Checked by main() before returning_

- [ ] All contracts have corresponding tests
- [ ] All entities have model tasks
- [ ] All tests come before implementation
- [ ] Parallel tasks truly independent
- [ ] Each task specifies exact file path
- [ ] No task modifies same file as another [P] task
