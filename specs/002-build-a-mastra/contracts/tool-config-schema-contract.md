# Contract: Tool Configuration Schema

**Feature**: 002-build-a-mastra  
**Version**: 1.0.0  
**Date**: 2025-10-05  
**Status**: Draft

## Purpose

Defines the contract for configuration input that drives dynamic tool generation. This contract ensures configuration files/objects are validated before tool creation.

## Input Schema

### Root Configuration

```typescript
interface ToolConfiguration {
  version: string; // Semver format, e.g., "1.0.0"
  tables: TableConfig[]; // At least 1 table required
  metadata?: ConfigMetadata; // Optional metadata
}
```

**Constraints**:

- `version`: Must match regex `^\d+\.\d+\.\d+$`
- `tables`: Non-empty array, max 100 tables
- Table `toolId` values must be unique across configuration

### Table Configuration

```typescript
interface TableConfig {
  tableName: string; // Database table name (snake_case)
  toolId: string; // Unique tool identifier (kebab-case)
  displayName: string; // Human-readable name
  description: string; // Tool purpose (10-500 chars)
  fields: FieldConfig[]; // At least 1 field required
  columnMappings?: Record<string, string>; // Logical → Physical mappings
  constraints?: TableConstraints; // Table-level constraints
}
```

**Constraints**:

- `tableName`: Matches `/^[a-z_][a-z0-9_]*$/`, 1-63 chars, must exist in Prisma schema
- `toolId`: Matches `/^[a-z][a-z0-9-]*$/`, 1-50 chars
- `displayName`: 1-100 chars
- `description`: 10-500 chars
- `fields`: Non-empty array, field names unique within table
- `columnMappings`: Keys must match field names, values must be valid column names

### Field Configuration (Discriminated Union)

**Text Field**:

```typescript
interface TextFieldConfig {
  name: string; // Field name (snake_case)
  label: string; // Display label
  dataType: "text";
  required: boolean;
  minLength?: number; // Min 0
  maxLength?: number; // Max length, if set must be >= minLength
  defaultValue?: string;
}
```

**Integer Field**:

```typescript
interface IntegerFieldConfig {
  name: string;
  label: string;
  dataType: "integer";
  required: boolean;
  min?: number; // Minimum value
  max?: number; // Maximum value, if set must be >= min
  defaultValue?: number;
}
```

**Numeric Field**:

```typescript
interface NumericFieldConfig {
  name: string;
  label: string;
  dataType: "numeric";
  required: boolean;
  min?: number;
  max?: number;
  precision?: number; // Decimal precision (default 10)
  scale?: number; // Decimal scale (default 2)
  defaultValue?: number;
}
```

**Boolean Field**:

```typescript
interface BooleanFieldConfig {
  name: string;
  label: string;
  dataType: "boolean";
  required: boolean;
  defaultValue?: boolean;
}
```

**Enum Field**:

```typescript
interface EnumFieldConfig {
  name: string;
  label: string;
  dataType: "enum";
  required: boolean;
  enumValues: string[]; // At least 1 value, max 100 values
  defaultValue?: string; // Must be in enumValues
}
```

**DateTime Field**:

```typescript
interface DateTimeFieldConfig {
  name: string;
  label: string;
  dataType: "datetime";
  required: boolean;
  minDate?: string; // ISO 8601 format
  maxDate?: string; // ISO 8601 format, if set must be >= minDate
  defaultValue?: string; // ISO 8601 format or "now"
}
```

**JSON Field**:

```typescript
interface JsonFieldConfig {
  name: string;
  label: string;
  dataType: "json";
  required: boolean;
  defaultValue?: Record<string, any>;
}
```

**Field Constraints**:

- `name`: Matches `/^[a-z_][a-z0-9_]*$/`, 1-63 chars, unique within table
- `label`: 1-100 chars
- `dataType`: One of "text" | "integer" | "numeric" | "boolean" | "enum" | "datetime" | "json"
- Type-specific constraints as documented above

### Metadata

```typescript
interface ConfigMetadata {
  name?: string; // 1-100 chars
  description?: string; // 1-500 chars
  author?: string; // 1-100 chars
  createdAt?: string; // ISO 8601 datetime
  tags?: string[]; // Array of non-empty strings
}
```

### Table Constraints

```typescript
interface TableConstraints {
  unique?: string[][]; // Each array: field names that must be unique together
  checks?: CheckConstraint[];
}

interface CheckConstraint {
  name: string; // Constraint name (snake_case)
  description: string; // Human-readable description
  fields: string[]; // Fields involved in check (must exist in table)
}
```

## Validation Rules

### Schema-Level

1. Configuration must be valid JSON or JavaScript object
2. Version must be semver format
3. At least one table required
4. Tool IDs must be unique across all tables

### Table-Level

1. Table name must exist in Prisma schema (runtime check)
2. Table name must be snake_case, valid PostgreSQL identifier
3. Tool ID must be unique, kebab-case
4. At least one field required
5. Field names unique within table
6. If columnMappings provided, keys must match field names

### Field-Level

1. Field name must be snake_case, valid PostgreSQL identifier
2. Data type must be supported type
3. Type-specific validation:
   - Text: maxLength >= minLength (if both set)
   - Integer/Numeric: max >= min (if both set)
   - Enum: enumValues non-empty, defaultValue in enumValues
   - DateTime: maxDate >= minDate (if both set)
4. Default value type must match field data type

## Example Valid Configuration

```json
{
  "version": "1.0.0",
  "metadata": {
    "name": "Mood Tracking Configuration",
    "author": "system",
    "createdAt": "2025-10-05T12:00:00Z",
    "tags": ["health", "mood"]
  },
  "tables": [
    {
      "tableName": "mood_entries",
      "toolId": "log-mood",
      "displayName": "Log Mood Entry",
      "description": "Record user mood and energy levels with optional notes",
      "fields": [
        {
          "name": "user_id",
          "label": "User ID",
          "dataType": "text",
          "required": true,
          "maxLength": 50
        },
        {
          "name": "mood",
          "label": "Mood",
          "dataType": "enum",
          "required": true,
          "enumValues": ["happy", "sad", "neutral", "anxious"]
        },
        {
          "name": "energy_level",
          "label": "Energy Level",
          "dataType": "integer",
          "required": true,
          "min": 1,
          "max": 10
        },
        {
          "name": "notes",
          "label": "Notes",
          "dataType": "text",
          "required": false,
          "maxLength": 500
        },
        {
          "name": "timestamp",
          "label": "Timestamp",
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

## Example Invalid Configurations

### Missing Required Field

```json
{
  "version": "1.0.0",
  "tables": [] // ERROR: At least one table required
}
```

### Invalid Table Name

```json
{
  "version": "1.0.0",
  "tables": [{
    "tableName": "MoodEntries", // ERROR: Must be snake_case
    "toolId": "log-mood",
    "displayName": "Log Mood",
    "description": "Track mood",
    "fields": [...]
  }]
}
```

### Invalid Field Constraints

```json
{
  "version": "1.0.0",
  "tables": [
    {
      "tableName": "mood_entries",
      "toolId": "log-mood",
      "displayName": "Log Mood",
      "description": "Track mood levels over time",
      "fields": [
        {
          "name": "energy",
          "label": "Energy",
          "dataType": "integer",
          "required": true,
          "min": 10,
          "max": 5 // ERROR: max must be >= min
        }
      ]
    }
  ]
}
```

### Duplicate Field Names

```json
{
  "version": "1.0.0",
  "tables": [
    {
      "tableName": "mood_entries",
      "toolId": "log-mood",
      "displayName": "Log Mood",
      "description": "Track mood levels",
      "fields": [
        {
          "name": "notes",
          "label": "Notes 1",
          "dataType": "text",
          "required": false
        },
        {
          "name": "notes",
          "label": "Notes 2",
          "dataType": "text",
          "required": false
        }
        // ERROR: Duplicate field name "notes"
      ]
    }
  ]
}
```

## Error Response Format

When configuration validation fails:

```typescript
{
  success: false,
  error: {
    type: "CONFIG_ERROR",
    message: "Configuration validation failed",
    details: {
      path: string[];     // Path to invalid field, e.g., ["tables", 0, "fields", 2, "min"]
      expected: string;   // Expected value/format
      received: string;   // Actual value received
      code: string;       // Error code, e.g., "invalid_type", "too_small"
    }
  }
}
```

## Implementation Notes

1. Configuration parsed and validated before any tool generation
2. Runtime table existence check against Prisma schema
3. Validation errors include detailed path information for debugging
4. Configuration immutable after validation (no hot reloading in v1)
5. Schema validation happens via Zod schemas defined in data-model.md

## Backwards Compatibility

Version 1.0.0 is initial version. Future versions will:

- Maintain backwards compatibility for 1.x.x versions
- Provide migration path for breaking changes (2.0.0+)
- Support version-specific parsers if needed

## Testing Requirements

### Valid Configuration Tests

- Minimal valid configuration (1 table, 1 field)
- Complex configuration (multiple tables, all field types)
- Optional fields omitted
- All field types represented
- Column mappings used
- Table constraints defined

### Invalid Configuration Tests

- Missing required fields
- Invalid semver version
- Empty tables array
- Duplicate tool IDs
- Invalid table names (non-snake_case, SQL keywords)
- Invalid field names
- Duplicate field names within table
- Type constraint violations (min > max, etc.)
- Invalid enum defaultValue
- Non-existent table in Prisma schema
- Malformed JSON

### Edge Cases

- Maximum number of tables (100)
- Maximum field name length (63 chars)
- Unicode in text fields
- Very long descriptions (500 chars)
- Empty enum values array
- Enum with 100 values (max)
