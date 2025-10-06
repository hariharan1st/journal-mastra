# Contract: Dynamic Tool Execution

**Feature**: 002-build-a-mastra  
**Version**: 1.0.0  
**Date**: 2025-10-05  
**Status**: Draft

## Purpose

Defines the contract for runtime execution of dynamically generated Mastra tools. Specifies input validation, execution flow, and output format.

## Tool Registration

Each table in configuration generates one Mastra tool with:

- **Tool ID**: From TableConfig.toolId
- **Tool Name**: From TableConfig.displayName
- **Tool Description**: From TableConfig.description
- **Input Schema**: Dynamically generated Zod schema from FieldConfig[]

## Input Schema (Runtime Generated)

Tool input schema generated from TableConfig.fields:

```typescript
// Example for mood_entries table
const MoodEntryInputSchema = z
  .object({
    user_id: z.string().max(50), // from text field
    mood: z.enum(["happy", "sad", "neutral", "anxious"]), // from enum field
    energy_level: z.number().int().min(1).max(10), // from integer field
    notes: z.string().max(500).optional(), // from optional text field
    timestamp: z.string().datetime(), // from datetime field
  })
  .strict(); // Reject unknown fields
```

**Generation Rules**:

1. Each FieldConfig → Zod schema type based on dataType
2. Apply type-specific constraints (min, max, length, enum values)
3. Mark optional if field.required === false
4. Use `.strict()` to reject unknown fields
5. Apply default values where specified

## Execution Flow

```
1. LLM invokes tool with input parameters
   ↓
2. Mastra validates input against generated Zod schema
   ↓ (if validation fails)
3. Return ToolExecutionError with VALIDATION_ERROR
   ↓ (if validation succeeds)
4. Map field names via columnMappings (if defined)
   ↓
5. Execute Prisma insert operation
   ↓ (if database error)
6. Return ToolExecutionError with DATABASE_ERROR
   ↓ (if insert succeeds)
7. Return ToolExecutionSuccess with row ID
```

## Input Format

Tool receives object with field values matching schema:

```typescript
// Example input for log-mood tool
{
  user_id: "user_123",
  mood: "happy",
  energy_level: 8,
  notes: "Great day today!",
  timestamp: "2025-10-05T14:30:00Z"
}
```

**Constraints**:

- All required fields must be present
- Field values must match configured data types
- Unknown fields rejected (strict validation)
- Enum values must be from configured enumValues
- Datetime must be valid ISO 8601

## Output Format

### Success Response

```typescript
{
  success: true,
  data: {
    id: string;           // UUID of inserted row (if table has id column)
    rowCount: number;     // Number of rows inserted (typically 1)
    message: string;      // Human-readable success message
  }
}
```

**Example**:

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "rowCount": 1,
    "message": "Successfully logged mood entry for user_123 at 2025-10-05T14:30:00Z"
  }
}
```

### Error Response

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR" | "DATABASE_ERROR" | "CONFIG_ERROR" | "UNKNOWN_ERROR",
    message: string;      // LLM-friendly error description
    details?: {
      field?: string;     // Field that caused error (for VALIDATION_ERROR)
      expected?: string;  // Expected value/type
      received?: string;  // Actual value received
      code?: string;      // Error code for programmatic handling
    }
  }
}
```

**Error Types**:

1. **VALIDATION_ERROR**: Input failed Zod validation

   ```json
   {
     "success": false,
     "error": {
       "type": "VALIDATION_ERROR",
       "message": "Field 'energy_level' must be between 1 and 10, but received 15",
       "details": {
         "field": "energy_level",
         "expected": "integer between 1 and 10",
         "received": "15",
         "code": "too_big"
       }
     }
   }
   ```

2. **DATABASE_ERROR**: Database operation failed

   ```json
   {
     "success": false,
     "error": {
       "type": "DATABASE_ERROR",
       "message": "Failed to insert mood entry: unique constraint violation on (user_id, timestamp)",
       "details": {
         "code": "P2002",
         "field": "user_id, timestamp"
       }
     }
   }
   ```

3. **CONFIG_ERROR**: Configuration issue detected at runtime

   ```json
   {
     "success": false,
     "error": {
       "type": "CONFIG_ERROR",
       "message": "Table 'mood_entries' does not exist in database schema",
       "details": {
         "code": "table_not_found"
       }
     }
   }
   ```

4. **UNKNOWN_ERROR**: Unexpected error
   ```json
   {
     "success": false,
     "error": {
       "type": "UNKNOWN_ERROR",
       "message": "An unexpected error occurred during tool execution",
       "details": {
         "code": "internal_error"
       }
     }
   }
   ```

## Data Type Validation

### Text Fields

- Type: string
- Constraints: minLength, maxLength
- Example validation error: "Field 'notes' exceeds maximum length of 500 characters"

### Integer Fields

- Type: number (integer only)
- Constraints: min, max, must be whole number
- Example validation error: "Field 'energy_level' must be an integer between 1 and 10"

### Numeric Fields

- Type: number (allows decimals)
- Constraints: min, max, precision, scale
- Example validation error: "Field 'temperature' must be a number with max 2 decimal places"

### Boolean Fields

- Type: boolean
- No additional constraints
- Example validation error: "Field 'is_active' must be true or false"

### Enum Fields

- Type: string (constrained to enumValues)
- Constraints: value must be in enumValues array
- Example validation error: "Field 'mood' must be one of: happy, sad, neutral, anxious"

### DateTime Fields

- Type: string (ISO 8601 format)
- Constraints: valid datetime, optional min/maxDate
- Example validation error: "Field 'timestamp' must be a valid ISO 8601 datetime"

### JSON Fields

- Type: object
- No schema validation (accepts any valid JSON object)
- Example validation error: "Field 'metadata' must be a valid JSON object"

## Column Mapping

If TableConfig.columnMappings defined, field names mapped before insert:

```typescript
// Configuration
{
  "fields": [
    { "name": "user_id", "label": "User ID", "dataType": "text", "required": true }
  ],
  "columnMappings": {
    "user_id": "telegram_user_id" // Map logical → physical
  }
}

// Runtime: Input field "user_id" → Database column "telegram_user_id"
```

**Mapping Rules**:

1. If field name in columnMappings, use mapped value as column name
2. Otherwise, use field name directly as column name
3. Mapped column must exist in database table
4. Mapping happens after validation, before database insert

## Database Operations

### Insert Operation

```typescript
// Pseudocode for single row insert
async function executeToolInsert(
  tableName: string,
  fieldValues: Record<string, any>,
  columnMappings?: Record<string, string>
): Promise<ToolExecutionResult> {
  // Map field names to columns
  const columnValues = applyColumnMappings(fieldValues, columnMappings);

  // Build parameterized query
  const columns = Object.keys(columnValues);
  const values = Object.values(columnValues);
  const placeholders = columns.map((_, i) => `$${i + 1}`);

  // Execute with Prisma
  const result = await prisma.$executeRawUnsafe(
    `INSERT INTO "${tableName}" (${columns.join(",")}) VALUES (${placeholders.join(",")}) RETURNING id`,
    ...values
  );

  return {
    success: true,
    data: {
      id: result.id,
      rowCount: 1,
      message: `Successfully inserted row into ${tableName}`,
    },
  };
}
```

**Transaction Handling**:

- Each tool execution runs in implicit transaction (Prisma default)
- If insert fails, transaction rolled back automatically
- No explicit transaction management required for single inserts
- Future: Support batching multiple inserts in single transaction

**Audit Trail**:

- All successful inserts may generate audit events (if configured)
- Audit events capture: tool ID, user/actor, timestamp, inserted row ID
- Follows existing AuditEvent pattern from 001-this-is-a

## Example Tool Definitions

### Simple Tool (Minimal Fields)

```typescript
const simpleNoteTool = createTool({
  id: "add-note",
  description: "Add a quick note",
  inputSchema: z
    .object({
      content: z.string().max(1000),
      created_at: z.string().datetime(),
    })
    .strict(),
  execute: async (input) => {
    // Insert into notes table
    return {
      success: true,
      data: {
        id: "...",
        rowCount: 1,
        message: "Note added successfully",
      },
    };
  },
});
```

### Complex Tool (All Field Types)

```typescript
const complexFormTool = createTool({
  id: "submit-health-form",
  description: "Submit comprehensive health tracking form",
  inputSchema: z
    .object({
      user_id: z.string().max(50),
      weight: z.number().min(0).max(500),
      height: z.number().int().min(0).max(300),
      is_smoker: z.boolean(),
      activity_level: z.enum([
        "sedentary",
        "light",
        "moderate",
        "active",
        "very_active",
      ]),
      notes: z.string().max(1000).optional(),
      recorded_at: z.string().datetime(),
      metadata: z.record(z.any()).optional(),
    })
    .strict(),
  execute: async (input) => {
    // Validate + Insert logic
  },
});
```

## Testing Requirements

### Input Validation Tests

- Valid input for each field type
- Invalid input for each field type
- Missing required fields
- Extra unknown fields (should be rejected)
- Boundary values (min, max, length limits)
- Enum values (valid and invalid)
- DateTime formats (valid ISO 8601 and invalid)

### Execution Tests

- Successful insert with minimal fields
- Successful insert with all fields
- Insert with optional fields omitted
- Insert with column mappings
- Database constraint violations (unique, check)
- Database connection errors
- Table not found error

### Error Response Tests

- Validation error format correct
- Database error format correct
- Error messages LLM-friendly
- Error details include relevant context
- Error codes consistent

### Edge Cases

- Very long text fields (at max length)
- Unicode in text fields
- Null vs undefined vs empty string
- Floating point precision
- Timezone handling in datetimes
- JSON field with nested objects
- Simultaneous constraint violations

## Performance Requirements

- **Validation**: < 10ms for typical input (5-10 fields)
- **Database Insert**: < 50ms for single row
- **Total Latency**: < 200ms end-to-end (validation + insert)
- **Throughput**: Support 100+ concurrent tool invocations

## Security Requirements

- **Input Sanitization**: All inputs validated via Zod before database
- **SQL Injection Prevention**: Use parameterized queries only
- **Table Whitelisting**: Validate table name against Prisma schema
- **Column Whitelisting**: Validate column names if columnMappings used
- **No Raw SQL**: Never construct SQL via string concatenation
- **Audit Logging**: Log all tool executions for security audit trail

## Backwards Compatibility

Version 1.0.0 contract. Future changes:

- Input schema additions: Minor version bump (1.1.0)
- Output format changes: Minor version bump
- Breaking changes: Major version bump (2.0.0)

## Notes

1. Tools generated once at agent startup, cached for performance
2. Configuration changes require agent restart (no hot reload in v1)
3. Error messages designed for LLM consumption (natural language)
4. Success messages include context for LLM to confirm action
5. All database operations use Prisma for type safety and security
