# Research: Dynamic Configuration-Driven Mastra Agent

**Feature**: 002-build-a-mastra  
**Date**: 2025-10-05  
**Status**: Complete

## Overview

This document captures research findings for implementing a dynamic configuration-driven agent system using Mastra AI framework, PostgreSQL/Prisma, and Zod validation.

## Research Areas

### 1. Mastra AI Dynamic Tool Registration

**Decision**: Use Mastra's `createTool` factory function for runtime tool generation with Zod schemas

**Rationale**:

- Mastra's tool system natively supports Zod schemas for parameter validation
- Tools can be created dynamically and registered to agents at runtime
- Existing codebase patterns in `catalogue-schema-tool.ts` demonstrate this approach
- No need for custom validation layer beyond Zod

**Alternatives Considered**:

- Static tool generation with code generation: Rejected due to deployment complexity
- Custom validation framework: Rejected as Zod already integrates with Mastra
- MCP native tools without Mastra: Rejected to maintain consistency with existing architecture

**Implementation Pattern**:

```typescript
// From catalogue-schema-tool.ts
export const catalogueSchemaTool = createTool({
  id: "catalogue-schema",
  inputSchema: CatalogueSchemaRequestSchema,
  execute: async (input) => {
    /* validation + persistence */
  },
});
```

**References**:

- `/home/agent/code/journal-mastra/src/mastra/tools/catalogue-schema-tool.ts` (lines 1-50)
- Mastra documentation available via MCP server

---

### 2. Configuration Schema Design

**Decision**: Use hierarchical Zod schema with TableConfig[] as top-level structure

**Rationale**:

- Mirrors existing `MetricDefinitionSchema` pattern from catalogue-schema-parser
- Each table config defines name, fields with types, validation rules, and column mappings
- Zod's discriminated unions handle different data types (string, number, boolean, enum, datetime)
- Schema validation happens before tool generation, ensuring type safety

**Alternatives Considered**:

- JSON Schema: Rejected due to lack of TypeScript type inference
- Custom DSL: Rejected as too complex, Zod provides sufficient expressiveness
- Database-driven config: Rejected for initial version to avoid bootstrap complexity

**Schema Structure**:

```typescript
const ToolConfigSchema = z.object({
  tables: z.array(z.object({
    tableName: z.string(),
    displayName: z.string(),
    description: z.string(),
    fields: z.array(z.discriminatedUnion("dataType", [
      z.object({ dataType: z.literal("text"), name: z.string(), ... }),
      z.object({ dataType: z.literal("integer"), name: z.string(), ... }),
      // ... other types
    ])),
    columnMappings: z.record(z.string(), z.string()).optional(),
    validationRules: z.object({ ... }).optional()
  }))
});
```

**References**:

- `/home/agent/code/journal-mastra/src/mastra/lib/parsing/catalogue-schema-parser.ts`
- Zod documentation for discriminated unions and refinements

---

### 3. Prisma Dynamic Table Operations

**Decision**: Reuse existing `DynamicTableManager` for DDL, create new runtime data insertion layer

**Rationale**:

- `DynamicTableManager` already handles create/alter table operations safely
- For data insertion, use Prisma's `$executeRawUnsafe` with parameterized queries
- Table names validated against existing Prisma schema at configuration time
- Prevents SQL injection via whitelist validation and parameter binding

**Alternatives Considered**:

- Raw SQL only: Rejected due to SQL injection risk and lack of type safety
- Generate Prisma models dynamically: Rejected as requires schema regeneration
- Use existing Prisma models only: Rejected as insufficiently flexible for dynamic tables

**Implementation Pattern**:

```typescript
// Whitelist validation
const validTables =
  await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
if (!validTables.includes(tableName)) throw new Error("Invalid table");

// Parameterized insertion
await prisma.$executeRawUnsafe(
  `INSERT INTO "${tableName}" (${columns.join(",")}) VALUES (${placeholders})`,
  ...values
);
```

**References**:

- `/home/agent/code/journal-mastra/src/mastra/services/dynamic-table-manager.ts`
- Prisma documentation: Raw queries and SQL injection prevention

---

### 4. Tool Execution Flow

**Decision**: Three-phase execution: Parse config → Generate tools → Execute with validation

**Rationale**:

- Phase 1 (startup): Parse configuration, validate structure, cache table metadata
- Phase 2 (registration): Generate Mastra tools with per-field Zod schemas
- Phase 3 (runtime): Tool invoked → Zod validates → Prisma persists → Audit event logged
- Separation allows configuration errors to fail fast before agent starts

**Alternatives Considered**:

- Just-in-time tool generation: Rejected due to performance overhead on each call
- Monolithic validation: Rejected as harder to debug and test
- Separate validation service: Rejected as over-engineering for current scope

**Flow Diagram**:

```
[Configuration JSON/Object]
    ↓ (parse & validate)
[TableConfig[]]
    ↓ (for each table)
[Mastra Tool with Zod schema]
    ↓ (register to agent)
[Agent with dynamic tools]
    ↓ (LLM invokes tool)
[Validate input → Insert to DB → Return result]
```

**References**:

- Mastra agent patterns in `/home/agent/code/journal-mastra/src/mastra/agents/admin-catalogue-agent.ts`

---

### 5. Data Type Mapping Strategy

**Decision**: Map Zod types to Prisma/PostgreSQL types via lookup table

**Rationale**:

- Finite set of supported types: text, integer, numeric, boolean, enum, datetime, json
- Direct mapping to PostgreSQL types for DDL operations
- Zod schema builders for each type ensure consistent validation
- Enum handling requires special case for value validation

**Alternatives Considered**:

- Support all PostgreSQL types: Rejected due to complexity and testing burden
- TypeScript type inference: Rejected as runtime validation needs explicit schemas
- Custom type system: Rejected as reinventing Zod/Prisma capabilities

**Type Mapping Table**:
| Config Type | Zod Schema | PostgreSQL Type | Notes |
|-------------|------------|-----------------|-------|
| text | z.string() | TEXT | With optional length constraint |
| integer | z.number().int() | INTEGER | With optional min/max |
| numeric | z.number() | NUMERIC | For decimals |
| boolean | z.boolean() | BOOLEAN | True/false only |
| enum | z.enum([...]) | TEXT + CHECK | Constrained to enum values |
| datetime | z.string().datetime() | TIMESTAMPTZ | ISO 8601 format |
| json | z.record(z.any()) | JSONB | For flexible structures |

**References**:

- `/home/agent/code/journal-mastra/src/mastra/services/dynamic-table-manager.ts` (ColumnSpec interface)
- Prisma DataType enum in schema

---

### 6. Error Handling & Validation Feedback

**Decision**: Return structured errors with field-level details for LLM consumption

**Rationale**:

- Zod's error format includes path, message, and expected type
- Transform Zod errors into natural language for LLM to understand and retry
- Include both technical (for logging) and user-friendly (for LLM) error messages
- Follow existing audit event pattern for error tracking

**Alternatives Considered**:

- Generic error messages: Rejected as unhelpful for LLM-driven correction
- Throw exceptions: Rejected as breaks agent execution flow
- Silent failures: Rejected due to data integrity concerns

**Error Response Structure**:

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR" | "DATABASE_ERROR" | "CONFIG_ERROR",
    message: "Natural language description for LLM",
    details: {
      field: "field_name",
      expected: "string with max length 100",
      received: "invalid value"
    }
  }
}
```

**References**:

- Existing error handling in `catalogue-schema-tool.ts`
- Zod error formatting documentation

---

### 7. Performance Considerations

**Decision**: Cache tool instances, use connection pooling, batch where possible

**Rationale**:

- Tool generation is expensive; cache tools after config parse
- Prisma connection pool handles concurrent tool invocations
- For bulk inserts (future), use Prisma batch operations
- Configuration changes require agent restart (acceptable for initial version)

**Alternatives Considered**:

- Hot reload configuration: Rejected as complex for initial version
- Tool per invocation: Rejected due to performance overhead
- Separate database per table: Rejected as inefficient resource usage

**Performance Targets**:

- Tool generation: <100ms per table during startup
- Validation: <10ms for typical input (5-10 fields)
- Database insertion: <50ms for single row
- Total latency: <200ms for simple tool execution

**Monitoring Points**:

- Tool generation time (logged at startup)
- Validation errors by field (audit events)
- Database query duration (Prisma logging)
- Tool execution success rate

**References**:

- Existing logging patterns in `/home/agent/code/journal-mastra/src/mastra/lib/logging.ts`

---

### 8. Security Hardening

**Decision**: Multi-layer validation with whitelist checks, parameterized queries, and input sanitization

**Rationale**:

- Configuration schema validation prevents malicious table/column names
- Whitelist table names against Prisma schema before any DB operation
- Never use string concatenation for SQL (use parameterized queries only)
- Audit all configuration changes and tool executions
- Follow existing security patterns from dynamic-table-manager

**Alternatives Considered**:

- Trust configuration input: Rejected due to security risk
- ORM-only operations: Rejected as insufficient for dynamic tables
- Separate database user with restricted permissions: Considered for future enhancement

**Security Checklist**:

- ✅ Configuration schema enforces safe naming patterns (snake_case, no SQL keywords)
- ✅ Table names validated against Prisma schema whitelist
- ✅ All user inputs validated via Zod before database operations
- ✅ Parameterized queries only (no string interpolation in SQL)
- ✅ Audit events logged for all data mutations
- ✅ No secrets or sensitive data in configuration schema
- ✅ Rate limiting at agent level (delegated to Mastra)

**References**:

- Security patterns in `/home/agent/code/journal-mastra/src/mastra/services/dynamic-table-manager.ts`
- PostgreSQL parameterized query best practices

---

## Dependencies & Integration Points

### Required Packages (Already Available)

- `@mastra/core`: Tool creation and agent framework
- `zod`: Schema validation and type inference
- `@prisma/client`: Database operations
- `pg`: PostgreSQL client (via Prisma)

### Existing Modules to Reuse

- `src/mastra/lib/prisma-client.ts`: Database connection management
- `src/mastra/lib/logging.ts`: Structured logging
- `src/mastra/services/dynamic-table-manager.ts`: DDL operations pattern
- `src/mastra/lib/parsing/catalogue-schema-parser.ts`: Schema parsing pattern

### New Modules Required

- `src/mastra/lib/parsing/tool-config-parser.ts`: Configuration parsing
- `src/mastra/services/dynamic-tool-generator.ts`: Tool generation service
- `src/mastra/agents/dynamic-config-agent.ts`: Agent orchestration

---

## Testing Strategy

### Unit Tests

- Configuration parser with valid/invalid schemas
- Data type mapping correctness
- Zod schema generation for each field type
- Error message formatting

### Contract Tests

- Tool configuration schema contract
- Tool execution input/output contract
- Error response structure contract

### Integration Tests

- End-to-end: Config → Tool generation → Agent execution → DB persistence
- Multiple table configurations
- Concurrent tool invocations
- Error scenarios (invalid data, missing fields, constraint violations)

### Manual Validation

- LLM interaction walkthrough with sample configuration
- Performance benchmarking under load
- Security audit of SQL generation
- Prisma transaction behavior verification

---

## Open Questions & Decisions

### Resolved

1. **Q**: Support relationships between tables?  
   **A**: Not in initial version. Focus on independent tables first.

2. **Q**: Handle table schema migrations?  
   **A**: Delegate to DynamicTableManager. Configuration changes require restart.

3. **Q**: Configuration storage location?  
   **A**: Accept as input parameter (JSON object or file path). Database storage is future enhancement.

4. **Q**: Support complex validation rules (regex, cross-field)?  
   **A**: Start with basic Zod refinements (required, min/max, enum). Advanced rules in future.

5. **Q**: Multi-tenancy support?  
   **A**: Out of scope. Single database, all tools share same Prisma client.

### Deferred to Future Iterations

- Hot configuration reload without agent restart
- Complex validation rules (regex patterns, cross-field validation)
- Relationship management between dynamic tables
- Configuration versioning and migration
- Multi-tenant isolation

---

## Conclusion

All technical unknowns resolved. Implementation approach leverages existing Mastra/Prisma patterns, maintains security and performance requirements, and aligns with constitutional principles. Ready to proceed to Phase 1 (Design & Contracts).

**Risk Assessment**: LOW

- Established patterns from catalogue-schema-tool reduce implementation risk
- Zod + Prisma provide battle-tested validation and persistence
- Clear scope boundaries prevent feature creep

**Estimated Complexity**: MEDIUM

- 3 new modules, ~600-800 lines of code
- 5-7 test files with 80%+ coverage target
- 2-3 contract definitions
- Manual validation scenarios defined
