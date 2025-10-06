# Tasks: Dynamic Configuration-Driven Mastra Agent

**Input**: Design documents from `/specs/002-build-a-mastra/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Extracted: TypeScript 5.9, Node.js 20.9, Mastra framework, PostgreSQL 15+, Prisma ORM
   → Structure: Single TypeScript service under src/mastra/
2. Load optional design documents:
   → data-model.md: 7 entities (ToolConfiguration, TableConfig, FieldConfig variants)
   → contracts/: 2 files (tool-config-schema-contract.md, dynamic-tool-execution-contract.md)
   → research.md: 5 technical decisions
   → manual-validation.md: 10 validation scenarios
3. Generate tasks by category:
   → Setup: TypeScript configuration, dependencies
   → Architecture: Schema definitions, parsing utilities
   → Core: Tool generator service, execution wrapper
   → Testing: Contract tests, unit tests, integration tests
   → Documentation & Validation: Manual validation evidence, quickstart updates
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Manual validation tasks reference evidence artifacts
5. Number tasks sequentially (T001-T024)
6. Validate completeness: All contracts covered ✓, All entities modeled ✓
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

Single project structure at repository root:

- Source: `src/mastra/`
- Tests: `tests/`
- Config: `config/`
- Docs: `specs/002-build-a-mastra/docs/validations/`

---

## Phase 3.1: Setup

- [ ] T001 [P] Install additional dependencies if needed (verify `@mastra/core`, `zod`, `@prisma/client` are present in package.json)
- [ ] T002 [P] Create config directory structure: `config/examples/` for sample configurations
- [ ] T003 [P] Create test fixtures directory: `specs/002-build-a-mastra/fixtures/` with valid and invalid config samples

## Phase 3.2: Architecture & Schema Definitions

- [ ] T004 [P] Create Zod schema for ToolConfiguration in `src/mastra/lib/parsing/tool-config-schema.ts`
  - Define ToolConfigurationSchema with version, tables, metadata fields
  - Export TypeScript types inferred from Zod schemas
- [ ] T005 [P] Create Zod schema for TableConfig in `src/mastra/lib/parsing/tool-config-schema.ts`
  - Define TableConfigSchema with tableName, toolId, displayName, description, fields
  - Add refinement for unique field names within table
- [ ] T006 [P] Create Zod schemas for FieldConfig discriminated union in `src/mastra/lib/parsing/tool-config-schema.ts`
  - Define TextFieldConfigSchema, IntegerFieldConfigSchema, NumericFieldConfigSchema
  - Define BooleanFieldConfigSchema, EnumFieldConfigSchema, DateTimeFieldConfigSchema, JsonFieldConfigSchema
  - Create FieldConfigSchema as discriminated union on dataType
- [ ] T007 [P] Create TypeScript types for ToolExecutionResult in `src/mastra/lib/types/tool-execution.ts`
  - Define ToolExecutionSuccess interface with success, data (id, rowCount, message)
  - Define ToolExecutionError interface with success, error (type, message, details)
  - Export union type ToolExecutionResult

## Phase 3.3: Core Parsing & Utilities

- [ ] T008 [P] Implement configuration parser in `src/mastra/lib/parsing/tool-config-parser.ts`
  - Export loadToolConfiguration(input: string | object): ToolConfiguration
  - Parse JSON string or accept object, validate against ToolConfigurationSchema
  - Throw ConfigError with detailed Zod error formatting on validation failure
- [ ] T009 [P] Create type mapping utilities in `src/mastra/lib/parsing/field-type-mapper.ts`
  - Export function fieldConfigToZodSchema(field: FieldConfig): ZodTypeAny
  - Map each FieldConfig type to corresponding Zod schema with constraints
  - Handle optional fields, default values, min/max, enum values
- [ ] T010 [P] Create error formatting utilities in `src/mastra/lib/parsing/error-formatter.ts`
  - Export formatZodError(error: ZodError): string - LLM-friendly error messages
  - Export formatDatabaseError(error: Error): ToolExecutionError
  - Include field path, expected/received values, actionable guidance

## Phase 3.4: Core Service Implementation

- [ ] T011 Implement DynamicToolGenerator service in `src/mastra/services/dynamic-tool-generator.ts`
  - Create class with generateTools(config: ToolConfiguration): Promise<MastraTool[]>
  - For each TableConfig, generate Mastra tool using createTool factory
  - Build input schema from fields using fieldConfigToZodSchema
  - Wire execute function to call tool execution wrapper (T012)
  - Cache generated schemas for performance
- [ ] T012 Implement tool execution wrapper in `src/mastra/services/tool-executor.ts`
  - Create executeTool(tableName, fieldValues, columnMappings): Promise<ToolExecutionResult>
  - Validate table name against Prisma schema (whitelist check)
  - Map field names via columnMappings if provided
  - Execute Prisma insert using $executeRawUnsafe with parameterized queries
  - Return ToolExecutionSuccess or ToolExecutionError
  - Log execution to audit trail using existing logging utilities
- [ ] T013 [P] Create column mapping logic in `src/mastra/lib/parsing/column-mapper.ts`
  - Export applyColumnMappings(fields: Record<string, any>, mappings?: Record<string, string>)
  - Map logical field names to physical column names
  - Preserve unmapped fields as-is

## Phase 3.5: Agent Integration

- [ ] T014 Create example agent in `src/mastra/agents/dynamic-config-agent.ts`
  - Load sample configuration from config/examples/mood-tracker.json
  - Use DynamicToolGenerator to create tools
  - Create Agent with generated tools and appropriate model configuration
  - Export agent for testing
- [ ] T015 [P] Create sample configuration files in `config/examples/`
  - mood-tracker.json: Example with text, enum, integer, datetime fields
  - habit-tracker.json: Example with boolean, numeric fields and constraints
  - Include inline comments (via description fields) documenting each configuration element

## Phase 3.6: Contract Testing

- [ ] T016 [P] Create contract test for tool configuration schema in `tests/contracts/tool-config-schema.contract.test.ts`
  - Test valid configuration loads successfully
  - Test each invalid configuration case from contract (missing fields, invalid format, duplicates)
  - Verify error messages match contract specification
  - Test all field types (text, integer, numeric, boolean, enum, datetime, json)
  - Test constraints (min/max, length, enum values, unique constraints)
- [ ] T017 [P] Create contract test for dynamic tool execution in `tests/contracts/dynamic-tool-execution.contract.test.ts`
  - Test tool generation from valid configuration
  - Test tool invocation with valid inputs
  - Test validation errors for invalid inputs (type mismatch, out of range, missing required)
  - Test database insertion and response format
  - Verify success response structure (id, rowCount, message)
  - Verify error response structure (type, message, details)

## Phase 3.7: Unit Testing

- [ ] T018 [P] Create unit tests for parser in `tests/lib/tool-config-parser.test.ts`
  - Test loadToolConfiguration with JSON string and object inputs
  - Test error handling for malformed JSON
  - Test each validation rule (semver version, snake_case names, unique IDs)
- [ ] T019 [P] Create unit tests for type mapper in `tests/lib/field-type-mapper.test.ts`
  - Test each field type mapping (text → z.string(), integer → z.number().int(), etc.)
  - Test constraint application (min/max, length, enum, required/optional)
  - Test default value handling
- [ ] T020 [P] Create unit tests for generator in `tests/services/dynamic-tool-generator.test.ts`
  - Test tool generation from multi-table configuration
  - Test schema caching behavior
  - Test tool ID uniqueness validation
  - Mock Prisma client for database validation checks
- [ ] T021 [P] Create unit tests for executor in `tests/services/tool-executor.test.ts`
  - Test column mapping application
  - Test table name whitelist validation
  - Test Prisma query construction (parameterized, SQL injection safe)
  - Test error formatting for database errors
  - Mock Prisma client for all database operations

## Phase 3.8: Integration Testing

- [ ] T022 Create end-to-end integration test in `tests/integration/dynamic-agent.integration.test.ts`
  - Load sample configuration (mood-tracker.json)
  - Generate tools and create agent
  - Invoke agent with natural language prompt
  - Verify tool is called with correct parameters
  - Verify data is persisted to database
  - Clean up test data after execution
  - Requires PostgreSQL test database running

## Phase 3.9: Documentation & Validation Evidence

- [ ] T023 Execute manual validation scenarios and capture evidence
  - **Scenario 1**: Valid configuration loading → Screenshot + console output to `docs/validations/001-valid-config-load.md`
  - **Scenario 2**: Invalid configuration rejection → Error outputs for 2a, 2b, 2c to `docs/validations/002-invalid-config-errors.md`
  - **Scenario 3**: Dynamic tool generation → Inspected tool structure to `docs/validations/003-tool-generation.md`
  - **Scenario 4-7**: Tool execution, validation, database persistence, error handling → Outputs to `docs/validations/004-007-execution-tests.md`
  - **Scenario 8-9**: Performance benchmarking → Metrics to `docs/validations/008-009-performance.md`
  - **Scenario 10**: Agent integration walkthrough → Full flow evidence to `docs/validations/010-agent-integration.md`
- [ ] T024 [P] Update project documentation
  - Update `specs/002-build-a-mastra/quickstart.md` with final implementation notes
  - Update repository README.md with dynamic tool system overview
  - Update `.github/copilot-instructions.md` with new modules and patterns

---

## Dependencies

**Setup Phase (T001-T003)** must complete before architecture work

**Architecture Phase (T004-T007)** foundation for:

- T008 (parser depends on schemas)
- T009 (type mapper depends on FieldConfig schemas)

**Parsing & Utilities (T008-T010)** foundation for:

- T011 (generator uses parser and type mapper)
- T012 (executor uses error formatter)

**Service Implementation (T011-T013)** must complete before:

- T014 (agent integration needs generator)
- T017 (execution contract tests need executor)
- T020 (generator unit tests)
- T021 (executor unit tests)

**Agent Integration (T014-T015)** enables:

- T022 (end-to-end integration test)
- T023 (manual validation scenarios)

**All Testing (T016-T022)** must complete before:

- T023 (manual validation requires working implementation)

**Documentation (T024)** depends on:

- T023 (validation evidence) completed

## Parallel Execution Examples

### Phase 3.2: Schema Definitions (4 independent files)

```bash
# Launch T004-T007 together - all create different sections of tool-config-schema.ts
Task: "Create Zod schema for ToolConfiguration in src/mastra/lib/parsing/tool-config-schema.ts"
Task: "Create Zod schema for TableConfig in src/mastra/lib/parsing/tool-config-schema.ts"
Task: "Create Zod schemas for FieldConfig discriminated union in src/mastra/lib/parsing/tool-config-schema.ts"
Task: "Create TypeScript types for ToolExecutionResult in src/mastra/lib/types/tool-execution.ts"
```

**Note**: T004-T006 edit same file, so execute sequentially. Only T007 can be parallel.

### Phase 3.3: Parsing & Utilities (3 independent modules)

```bash
# Launch T008-T010 together - different files
Task: "Implement configuration parser in src/mastra/lib/parsing/tool-config-parser.ts"
Task: "Create type mapping utilities in src/mastra/lib/parsing/field-type-mapper.ts"
Task: "Create error formatting utilities in src/mastra/lib/parsing/error-formatter.ts"
```

### Phase 3.6: Contract Tests (2 independent test files)

```bash
# Launch T016-T017 together
Task: "Create contract test for tool configuration schema in tests/contracts/tool-config-schema.contract.test.ts"
Task: "Create contract test for dynamic tool execution in tests/contracts/dynamic-tool-execution.contract.test.ts"
```

### Phase 3.7: Unit Tests (4 independent test files)

```bash
# Launch T018-T021 together
Task: "Create unit tests for parser in tests/lib/tool-config-parser.test.ts"
Task: "Create unit tests for type mapper in tests/lib/field-type-mapper.test.ts"
Task: "Create unit tests for generator in tests/services/dynamic-tool-generator.test.ts"
Task: "Create unit tests for executor in tests/services/tool-executor.test.ts"
```

---

## Notes

- **[P] markers**: Indicate tasks on different files or independent modules
- **Schema tasks (T004-T006)**: Edit same file sequentially, but can be developed as separate functions
- **Database operations**: All Prisma operations use parameterized queries for SQL injection safety
- **Manual validation**: All evidence stored under `specs/002-build-a-mastra/docs/validations/` with scenario numbers
- **Performance targets**: Sub-200ms tool execution, 100+ concurrent invocations (validated in Scenario 8-9)
- **Audit trail**: All data mutations logged using existing `logging.ts` utilities

## Task Generation Rules Applied

1. **From Contracts**:
   - tool-config-schema-contract.md → T016 (contract test)
   - dynamic-tool-execution-contract.md → T017 (contract test)
2. **From Data Model**:
   - ToolConfiguration entity → T004 (schema)
   - TableConfig entity → T005 (schema)
   - FieldConfig entities (7 types) → T006 (discriminated union schemas)
   - ToolExecutionResult types → T007 (TypeScript types)
3. **From Research Decisions**:
   - Configuration schema design → T004-T006
   - Mastra dynamic tool registration → T011
   - Prisma dynamic operations → T012
   - Tool execution flow → T012
   - Type mapping strategy → T009

4. **From Quickstart Scenarios**:
   - Mood tracker example → T015 (sample configs)
   - Agent integration → T014 (example agent)
   - Step-by-step usage → T024 (documentation updates)

5. **From Manual Validation**:
   - 10 scenarios → T023 (evidence capture for each)
   - Performance benchmarks → Included in T023

## Validation Checklist

- [x] All contracts have corresponding tests (T016, T017)
- [x] All entities have schema/type tasks (T004-T007)
- [x] Tests come before implementation where feasible (contract tests T016-T017 can run alongside implementation)
- [x] Parallel tasks are independent (verified file paths)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task (T004-T006 sequential, same file)
- [x] Manual validation references artifacts (T023 → docs/validations/\*.md)

---

**Estimated Duration**: 18-22 hours (6-8 hours for implementation, 4-6 hours for testing, 4-6 hours for validation)

**Ready for execution**: All tasks are specific, ordered, and independently executable.
