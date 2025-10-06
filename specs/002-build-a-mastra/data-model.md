# Data Model: Dynamic Configuration-Driven Mastra Agent

**Feature**: 002-build-a-mastra  
**Date**: 2025-10-05  
**Status**: Complete

## Overview

This document defines the data entities, relationships, and validation rules for the dynamic configuration-driven agent system. The model focuses on configuration structures that drive tool generation, not database schema (which is defined by configuration content).

## Core Entities

### 1. ToolConfiguration

The root configuration object that defines all dynamic tools for an agent.

**Fields**:

- `version`: string - Configuration schema version (e.g., "1.0.0")
- `tables`: TableConfig[] - Array of table configurations
- `metadata`: ConfigMetadata - Optional metadata about configuration

**Validation Rules**:

- Version must follow semver format
- Tables array must contain at least 1 table
- Table names must be unique within configuration

**State Transitions**: N/A (immutable after parsing)

**TypeScript Type**:

```typescript
interface ToolConfiguration {
  version: string;
  tables: TableConfig[];
  metadata?: ConfigMetadata;
}
```

**Zod Schema**:

```typescript
const ToolConfigurationSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format"),
  tables: z.array(TableConfigSchema).min(1, "At least one table required"),
  metadata: ConfigMetadataSchema.optional(),
});
```

---

### 2. TableConfig

Configuration for a single database table and its corresponding Mastra tool.

**Fields**:

- `tableName`: string - Database table name (snake_case, must exist in schema)
- `toolId`: string - Unique identifier for generated Mastra tool
- `displayName`: string - Human-readable name for UI/LLM
- `description`: string - Purpose of the table/tool
- `fields`: FieldConfig[] - Field definitions
- `columnMappings`: Record<string, string> - Optional logical → physical column mappings
- `constraints`: TableConstraints - Optional table-level constraints

**Validation Rules**:

- `tableName` must match regex `^[a-z_][a-z0-9_]*$` (snake_case)
- `toolId` must be unique across all tables in configuration
- `tableName` must exist in Prisma schema (validated at runtime)
- Field names must be unique within table
- At least one field required

**Relationships**:

- Has many FieldConfig (composition)
- References physical database table (via tableName validation)

**TypeScript Type**:

```typescript
interface TableConfig {
  tableName: string;
  toolId: string;
  displayName: string;
  description: string;
  fields: FieldConfig[];
  columnMappings?: Record<string, string>;
  constraints?: TableConstraints;
}
```

**Zod Schema**:

```typescript
const TableConfigSchema = z
  .object({
    tableName: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*$/, "Table name must be snake_case")
      .min(1)
      .max(63),
    toolId: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, "Tool ID must be kebab-case")
      .min(1)
      .max(50),
    displayName: z.string().min(1).max(100),
    description: z.string().min(10).max(500),
    fields: z.array(FieldConfigSchema).min(1, "At least one field required"),
    columnMappings: z.record(z.string(), z.string()).optional(),
    constraints: TableConstraintsSchema.optional(),
  })
  .refine(
    (data) => {
      const fieldNames = new Set(data.fields.map((f) => f.name));
      return fieldNames.size === data.fields.length;
    },
    { message: "Field names must be unique within table" }
  );
```

---

### 3. FieldConfig

Configuration for a single field within a table.

**Fields**:

- `name`: string - Logical field name (snake_case)
- `label`: string - Human-readable label
- `dataType`: DataTypeEnum - Field data type
- `required`: boolean - Whether field is mandatory
- `defaultValue`: any - Optional default value
- `validation`: FieldValidation - Optional validation rules

**Data Type Options** (discriminated union):

- `text`: String field with optional min/max length
- `integer`: Whole number with optional min/max
- `numeric`: Decimal number with optional precision
- `boolean`: True/false value
- `enum`: String constrained to predefined values
- `datetime`: ISO 8601 datetime string
- `json`: Flexible JSON object

**Validation Rules**:

- `name` must be snake_case
- `label` must be non-empty
- Type-specific validation based on `dataType`:
  - `enum`: Must provide `enumValues` array
  - `text`: Optional `minLength`, `maxLength`
  - `integer`/`numeric`: Optional `min`, `max`
  - `datetime`: Optional `minDate`, `maxDate`
- `defaultValue` type must match `dataType`

**Relationships**:

- Belongs to TableConfig
- May map to different physical column via `columnMappings`

**TypeScript Type** (discriminated union):

```typescript
type FieldConfig =
  | TextFieldConfig
  | IntegerFieldConfig
  | NumericFieldConfig
  | BooleanFieldConfig
  | EnumFieldConfig
  | DateTimeFieldConfig
  | JsonFieldConfig;

interface BaseFieldConfig {
  name: string;
  label: string;
  required: boolean;
  defaultValue?: any;
}

interface TextFieldConfig extends BaseFieldConfig {
  dataType: "text";
  minLength?: number;
  maxLength?: number;
}

interface IntegerFieldConfig extends BaseFieldConfig {
  dataType: "integer";
  min?: number;
  max?: number;
}

interface EnumFieldConfig extends BaseFieldConfig {
  dataType: "enum";
  enumValues: string[];
}

// ... similar for other types
```

**Zod Schema**:

```typescript
const BaseFieldConfigSchema = z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/, "Must be snake_case"),
  label: z.string().min(1).max(100),
  required: z.boolean(),
});

const TextFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("text"),
  minLength: z.number().int().positive().optional(),
  maxLength: z.number().int().positive().optional(),
  defaultValue: z.string().optional(),
}).refine(
  (data) =>
    !data.minLength || !data.maxLength || data.minLength <= data.maxLength,
  { message: "minLength must be <= maxLength" }
);

const IntegerFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("integer"),
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  defaultValue: z.number().int().optional(),
}).refine((data) => !data.min || !data.max || data.min <= data.max, {
  message: "min must be <= max",
});

const EnumFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("enum"),
  enumValues: z.array(z.string()).min(1, "At least one enum value required"),
  defaultValue: z.string().optional(),
}).refine(
  (data) => !data.defaultValue || data.enumValues.includes(data.defaultValue),
  { message: "defaultValue must be one of enumValues" }
);

// ... similar for other types

const FieldConfigSchema = z.discriminatedUnion("dataType", [
  TextFieldConfigSchema,
  IntegerFieldConfigSchema,
  NumericFieldConfigSchema,
  BooleanFieldConfigSchema,
  EnumFieldConfigSchema,
  DateTimeFieldConfigSchema,
  JsonFieldConfigSchema,
]);
```

---

### 4. ToolExecutionInput

Runtime input provided by LLM when invoking a generated tool.

**Fields**:

- Dynamic field names based on FieldConfig definitions
- Each field value validated against its FieldConfig specification

**Validation Rules**:

- All `required` fields must be present
- Field values must match configured data types
- Field values must pass type-specific validation (length, range, enum membership)
- Unknown fields rejected

**TypeScript Type** (generated dynamically):

```typescript
// Example for a specific table
interface SampleToolInput {
  mood: "happy" | "sad" | "neutral"; // enum field
  mood_notes?: string; // optional text field
  energy_level: number; // required integer field
  timestamp: string; // datetime field
}
```

**Zod Schema** (generated dynamically from FieldConfig):

```typescript
// Example generation logic
function generateInputSchema(tableConfig: TableConfig): z.ZodObject {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of tableConfig.fields) {
    let fieldSchema = getZodSchemaForType(field);

    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }

    shape[field.name] = fieldSchema;
  }

  return z.object(shape).strict(); // reject unknown fields
}
```

---

### 5. ToolExecutionResult

Result returned after tool execution (success or error).

**Fields**:

- `success`: boolean - Whether operation succeeded
- `data`: any - Result data (e.g., inserted row ID) if successful
- `error`: ErrorDetails - Error information if failed

**Validation Rules**:

- If `success` is true, `data` must be present and `error` must be absent
- If `success` is false, `error` must be present and `data` must be absent

**State Transitions**: N/A (terminal result)

**TypeScript Type**:

```typescript
type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionError;

interface ToolExecutionSuccess {
  success: true;
  data: {
    id?: string; // inserted row ID if applicable
    rowCount?: number; // number of rows affected
    message: string; // human-readable success message
  };
}

interface ToolExecutionError {
  success: false;
  error: {
    type:
      | "VALIDATION_ERROR"
      | "DATABASE_ERROR"
      | "CONFIG_ERROR"
      | "UNKNOWN_ERROR";
    message: string; // LLM-friendly error description
    details?: {
      field?: string; // field that caused error (if validation)
      expected?: string; // expected value/type
      received?: string; // actual value received
      code?: string; // error code for programmatic handling
    };
  };
}
```

**Zod Schema**:

```typescript
const ToolExecutionSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({
    id: z.string().optional(),
    rowCount: z.number().int().nonnegative().optional(),
    message: z.string(),
  }),
});

const ToolExecutionErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    type: z.enum([
      "VALIDATION_ERROR",
      "DATABASE_ERROR",
      "CONFIG_ERROR",
      "UNKNOWN_ERROR",
    ]),
    message: z.string(),
    details: z
      .object({
        field: z.string().optional(),
        expected: z.string().optional(),
        received: z.string().optional(),
        code: z.string().optional(),
      })
      .optional(),
  }),
});

const ToolExecutionResultSchema = z.union([
  ToolExecutionSuccessSchema,
  ToolExecutionErrorSchema,
]);
```

---

### 6. ConfigMetadata

Optional metadata about the configuration.

**Fields**:

- `name`: string - Configuration name/identifier
- `description`: string - Purpose of this configuration
- `author`: string - Who created the configuration
- `createdAt`: string - ISO 8601 timestamp
- `tags`: string[] - Classification tags

**Validation Rules**:

- All fields optional
- `createdAt` must be valid ISO 8601 if provided
- `tags` array elements must be non-empty strings

**TypeScript Type**:

```typescript
interface ConfigMetadata {
  name?: string;
  description?: string;
  author?: string;
  createdAt?: string;
  tags?: string[];
}
```

**Zod Schema**:

```typescript
const ConfigMetadataSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(500).optional(),
  author: z.string().min(1).max(100).optional(),
  createdAt: z.string().datetime().optional(),
  tags: z.array(z.string().min(1)).optional(),
});
```

---

### 7. TableConstraints

Optional table-level validation constraints.

**Fields**:

- `unique`: string[][] - Arrays of field names that must be unique together
- `checks`: CheckConstraint[] - Custom validation checks

**Validation Rules**:

- Unique constraint field names must exist in table's fields
- At least one field per unique constraint

**TypeScript Type**:

```typescript
interface TableConstraints {
  unique?: string[][];
  checks?: CheckConstraint[];
}

interface CheckConstraint {
  name: string;
  description: string;
  fields: string[];
  // Future: expression for complex checks
}
```

**Zod Schema**:

```typescript
const CheckConstraintSchema = z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  description: z.string().min(1),
  fields: z.array(z.string()).min(1),
});

const TableConstraintsSchema = z.object({
  unique: z.array(z.array(z.string()).min(1)).optional(),
  checks: z.array(CheckConstraintSchema).optional(),
});
```

---

## Entity Relationships

```
ToolConfiguration (1) ─── has many ──→ (N) TableConfig
                                           │
                                           │ has many
                                           ↓
                                      (N) FieldConfig

TableConfig ─── references ──→ Database Table (via tableName)

FieldConfig ─── maps to ──→ Database Column (via columnMappings or name)

ToolExecutionInput ─── conforms to ──→ FieldConfig[]

ToolExecutionResult ─── returned by ──→ Tool Execution
```

## Data Flow

```
1. Configuration JSON
   ↓ (validate via ToolConfigurationSchema)
2. ToolConfiguration object
   ↓ (iterate tables)
3. TableConfig[]
   ↓ (for each table: generate Zod schema from fields)
4. Mastra Tool with dynamic input schema
   ↓ (LLM invokes tool)
5. ToolExecutionInput
   ↓ (validate via generated schema)
6. Validated field values
   ↓ (map via columnMappings)
7. Database column values
   ↓ (Prisma insert)
8. Database row
   ↓ (return result)
9. ToolExecutionResult
```

## Validation Summary

| Entity              | Required Fields                                     | Unique Constraints   | Cross-Field Validation                                           |
| ------------------- | --------------------------------------------------- | -------------------- | ---------------------------------------------------------------- |
| ToolConfiguration   | version, tables                                     | N/A                  | tables must have unique names                                    |
| TableConfig         | tableName, toolId, displayName, description, fields | toolId across config | fields must have unique names, tableName must exist in DB        |
| FieldConfig         | name, label, dataType, required                     | name within table    | defaultValue type matches dataType, enum must provide enumValues |
| ToolExecutionInput  | All required fields from FieldConfig                | N/A                  | Values match field types and constraints                         |
| ToolExecutionResult | success                                             | N/A                  | success=true requires data, success=false requires error         |

## Example Configuration

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "Daily Mood Tracker",
    "description": "Track user mood and energy levels",
    "author": "system",
    "createdAt": "2025-10-05T00:00:00Z",
    "tags": ["health", "mood"]
  },
  "tables": [
    {
      "tableName": "mood_entries",
      "toolId": "log-mood",
      "displayName": "Log Mood Entry",
      "description": "Record a user's mood and energy level for a specific time",
      "fields": [
        {
          "name": "user_id",
          "label": "User ID",
          "dataType": "text",
          "required": true
        },
        {
          "name": "mood",
          "label": "Current Mood",
          "dataType": "enum",
          "enumValues": ["happy", "sad", "neutral", "anxious", "excited"],
          "required": true
        },
        {
          "name": "energy_level",
          "label": "Energy Level (1-10)",
          "dataType": "integer",
          "min": 1,
          "max": 10,
          "required": true
        },
        {
          "name": "notes",
          "label": "Additional Notes",
          "dataType": "text",
          "maxLength": 500,
          "required": false
        },
        {
          "name": "timestamp",
          "label": "Entry Timestamp",
          "dataType": "datetime",
          "required": true
        }
      ],
      "constraints": {
        "unique": [["user_id", "timestamp"]]
      }
    }
  ]
}
```

## Notes

- Configuration is immutable after parsing (no runtime schema updates)
- Database schema must be created separately (via DynamicTableManager or migrations)
- Column mappings allow logical field names to differ from physical columns
- Tool generation happens once at agent startup, tools are cached
- All runtime validation happens via generated Zod schemas
- Error messages designed for LLM consumption (natural language, actionable)
