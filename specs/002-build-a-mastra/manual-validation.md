# Manual Validation Plan: Dynamic Configuration-Driven Mastra Agent

**Feature**: 002-build-a-mastra  
**Date**: 2025-10-05  
**Status**: Draft

## Overview

This document describes the manual validation approach for testing the dynamic configuration-driven agent system. Since this is infrastructure code with deterministic behavior, we'll use a combination of contract tests and manual walkthrough scenarios.

## Validation Objectives

1. **Configuration Parsing**: Verify configuration validation catches all invalid inputs
2. **Tool Generation**: Confirm tools are generated correctly from configuration
3. **Runtime Validation**: Ensure Zod schemas validate inputs as expected
4. **Database Persistence**: Verify data is inserted correctly with proper mappings
5. **Error Handling**: Validate error messages are clear and actionable for LLMs
6. **Performance**: Confirm latency targets are met

## Pre-Validation Setup

### Environment Setup

```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Run migrations
npx prisma migrate dev

# Install dependencies (if not already installed)
npm install

# Build project
npm run build
```

### Test Data Preparation

1. Create test configuration file: `config/test-mood-tracker.json`
2. Ensure `mood_entries` table exists in test database
3. Clear any existing test data

## Validation Scenarios

### Scenario 1: Valid Configuration Loading

**Objective**: Verify valid configuration loads without errors

**Setup**:

```bash
cp specs/002-build-a-mastra/fixtures/valid-mood-config.json config/test-config.json
```

**Steps**:

1. Load configuration from file
2. Parse and validate using `loadToolConfiguration()`
3. Check no validation errors thrown
4. Verify parsed object matches expected structure

**Expected Output**:

```typescript
{
  version: "1.0.0",
  tables: [
    {
      tableName: "mood_entries",
      toolId: "log-mood",
      fields: [...] // All fields parsed correctly
    }
  ]
}
```

**Success Criteria**:

- ✅ No errors thrown during parsing
- ✅ All fields present in parsed object
- ✅ Data types match expected TypeScript types

**Evidence**: Screenshot of successful parse + console output

---

### Scenario 2: Invalid Configuration Rejection

**Objective**: Verify invalid configurations are rejected with clear errors

**Test Cases**:

#### 2a: Missing Required Field

```json
{
  "version": "1.0.0",
  "tables": [] // INVALID: Empty array
}
```

**Expected Error**:

```
ConfigError: Configuration validation failed
- Path: tables
- Message: At least one table required
- Code: too_small
```

#### 2b: Invalid Table Name

```json
{
  "version": "1.0.0",
  "tables": [{
    "tableName": "MoodEntries", // INVALID: Not snake_case
    ...
  }]
}
```

**Expected Error**:

```
ConfigError: Table name validation failed
- Path: tables.0.tableName
- Message: Table name must be snake_case
- Expected: /^[a-z_][a-z0-9_]*$/
- Received: "MoodEntries"
```

#### 2c: Duplicate Field Names

```json
{
  "tables": [{
    "fields": [
      { "name": "notes", "dataType": "text", ... },
      { "name": "notes", "dataType": "text", ... } // INVALID: Duplicate
    ]
  }]
}
```

**Expected Error**:

```
ConfigError: Field validation failed
- Path: tables.0.fields
- Message: Field names must be unique within table
```

**Success Criteria**:

- ✅ All invalid configurations rejected
- ✅ Error messages include path to invalid field
- ✅ Error messages are actionable (explain what's wrong and how to fix)

**Evidence**: Console output for each test case showing error messages

---

### Scenario 3: Dynamic Tool Generation

**Objective**: Verify tools are generated correctly from configuration

**Setup**:

```typescript
const config = loadToolConfiguration(validConfigJson);
const generator = new DynamicToolGenerator();
const tools = await generator.generateTools(config);
```

**Steps**:

1. Load valid configuration with 2 tables
2. Generate tools using DynamicToolGenerator
3. Inspect generated tools array
4. Verify each tool has correct properties

**Expected Output**:

```typescript
[
  {
    id: "log-mood",
    description: "Record user's mood and energy level...",
    inputSchema: ZodObject<{
      user_id: ZodString,
      mood: ZodEnum<["happy", "sad", "neutral", "anxious", "excited"]>,
      energy_level: ZodNumber.int().min(1).max(10),
      notes: ZodString.max(500).optional(),
      timestamp: ZodString.datetime()
    }>,
    execute: Function
  },
  {
    id: "log-sleep",
    // ... similar structure
  }
]
```

**Validation Checks**:

1. Number of tools matches number of tables (2)
2. Tool IDs match configured toolId values
3. Input schemas have correct fields
4. Field types match configured dataType
5. Required fields are not optional
6. Optional fields marked with `.optional()`
7. Execute function is present and callable

**Success Criteria**:

- ✅ Tools generated for all configured tables
- ✅ Input schemas correctly reflect field configurations
- ✅ Validation rules (min, max, enum) applied to schemas

**Evidence**:

- JSON dump of generated tools structure
- Screenshot of schema inspection

---

### Scenario 4: Valid Tool Execution

**Objective**: Verify tool executes successfully with valid input

**Setup**:

```typescript
const tools = await generator.generateTools(config);
const logMoodTool = tools.find((t) => t.id === "log-mood");
```

**Input**:

```typescript
{
  user_id: "test_user_001",
  mood: "happy",
  energy_level: 8,
  notes: "Feeling great today!",
  timestamp: "2025-10-05T14:30:00Z"
}
```

**Steps**:

1. Execute tool with valid input
2. Verify database row inserted
3. Check return value

**Expected Output**:

```typescript
{
  success: true,
  data: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    rowCount: 1,
    message: "Successfully logged mood entry for test_user_001 at 2025-10-05T14:30:00Z"
  }
}
```

**Database Verification**:

```sql
SELECT * FROM mood_entries WHERE user_id = 'test_user_001';
```

**Expected Row**:

```
id         | user_id       | mood  | energy_level | notes               | timestamp
-----------|---------------|-------|--------------|---------------------|-------------------------
550e8400...| test_user_001 | happy | 8            | Feeling great...    | 2025-10-05 14:30:00+00
```

**Success Criteria**:

- ✅ Tool execution returns success
- ✅ Row inserted into database
- ✅ All field values match input
- ✅ Return value includes row ID
- ✅ Success message is descriptive

**Evidence**:

- Console output of tool execution result
- SQL query result screenshot

---

### Scenario 5: Invalid Input Validation

**Objective**: Verify tool rejects invalid inputs with clear errors

**Test Cases**:

#### 5a: Missing Required Field

**Input**:

```typescript
{
  user_id: "test_user_001",
  mood: "happy"
  // Missing: energy_level, timestamp
}
```

**Expected Error**:

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR",
    message: "Field 'energy_level' is required but was not provided",
    details: {
      field: "energy_level",
      expected: "integer between 1 and 10",
      code: "invalid_type"
    }
  }
}
```

#### 5b: Out of Range Integer

**Input**:

```typescript
{
  user_id: "test_user_001",
  mood: "happy",
  energy_level: 15, // INVALID: max is 10
  timestamp: "2025-10-05T14:30:00Z"
}
```

**Expected Error**:

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR",
    message: "Field 'energy_level' must be between 1 and 10, but received 15",
    details: {
      field: "energy_level",
      expected: "integer between 1 and 10",
      received: "15",
      code: "too_big"
    }
  }
}
```

#### 5c: Invalid Enum Value

**Input**:

```typescript
{
  user_id: "test_user_001",
  mood: "ecstatic", // INVALID: not in enum values
  energy_level: 8,
  timestamp: "2025-10-05T14:30:00Z"
}
```

**Expected Error**:

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR",
    message: "Field 'mood' must be one of: happy, sad, neutral, anxious, excited",
    details: {
      field: "mood",
      expected: "one of: happy, sad, neutral, anxious, excited",
      received: "ecstatic",
      code: "invalid_enum_value"
    }
  }
}
```

#### 5d: String Too Long

**Input**:

```typescript
{
  user_id: "test_user_001",
  mood: "happy",
  energy_level: 8,
  notes: "x".repeat(501), // INVALID: max length 500
  timestamp: "2025-10-05T14:30:00Z"
}
```

**Expected Error**:

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR",
    message: "Field 'notes' exceeds maximum length of 500 characters",
    details: {
      field: "notes",
      expected: "string with max length 500",
      code: "too_big"
    }
  }
}
```

#### 5e: Invalid DateTime Format

**Input**:

```typescript
{
  user_id: "test_user_001",
  mood: "happy",
  energy_level: 8,
  timestamp: "2025-10-05" // INVALID: missing time component
}
```

**Expected Error**:

```typescript
{
  success: false,
  error: {
    type: "VALIDATION_ERROR",
    message: "Field 'timestamp' must be a valid ISO 8601 datetime",
    details: {
      field: "timestamp",
      expected: "ISO 8601 datetime (e.g., 2025-10-05T14:30:00Z)",
      received: "2025-10-05",
      code: "invalid_string"
    }
  }
}
```

**Success Criteria**:

- ✅ All invalid inputs rejected before database operation
- ✅ No database rows inserted for invalid inputs
- ✅ Error messages identify specific field and issue
- ✅ Error messages suggest correct format/value

**Evidence**: Console output for each test case

---

### Scenario 6: Column Mapping

**Objective**: Verify field names are correctly mapped to database columns

**Configuration**:

```json
{
  "tableName": "mood_entries",
  "fields": [
    { "name": "user_id", "label": "User", "dataType": "text", "required": true }
  ],
  "columnMappings": {
    "user_id": "telegram_user_id"
  }
}
```

**Input**:

```typescript
{
  user_id: "test_user_001",
  mood: "happy",
  energy_level: 8,
  timestamp: "2025-10-05T14:30:00Z"
}
```

**Steps**:

1. Execute tool with input
2. Query database to verify column used

**Database Verification**:

```sql
SELECT telegram_user_id FROM mood_entries WHERE id = ?;
```

**Expected**: `telegram_user_id` column contains "test_user_001"

**Success Criteria**:

- ✅ Logical field name (user_id) maps to physical column (telegram_user_id)
- ✅ Data inserted into correct column
- ✅ No errors during mapping

**Evidence**: SQL query result showing correct column

---

### Scenario 7: Database Constraint Violations

**Objective**: Verify database errors are handled gracefully

**Test Case**: Unique Constraint Violation

**Setup**:

```json
{
  "constraints": {
    "unique": [["user_id", "timestamp"]]
  }
}
```

**Steps**:

1. Insert row with user_id="user_001", timestamp="2025-10-05T14:00:00Z"
2. Attempt to insert duplicate row with same user_id and timestamp

**Expected Error**:

```typescript
{
  success: false,
  error: {
    type: "DATABASE_ERROR",
    message: "Failed to insert mood entry: unique constraint violation on (user_id, timestamp)",
    details: {
      code: "P2002",
      field: "user_id, timestamp"
    }
  }
}
```

**Success Criteria**:

- ✅ Second insert fails (does not overwrite)
- ✅ Error type is DATABASE_ERROR
- ✅ Error message mentions specific constraint
- ✅ No partial data inserted

**Evidence**: Error message screenshot + database state verification

---

### Scenario 8: Performance Validation

**Objective**: Verify performance targets are met

**Metrics**:

#### Tool Generation Performance

**Test**: Generate tools for configuration with 20 tables

**Target**: < 100ms per table (< 2000ms total)

**Steps**:

1. Load configuration with 20 tables
2. Measure time to generate all tools
3. Calculate per-table average

**Success Criteria**:

- ✅ Total generation time < 2000ms
- ✅ No memory leaks during generation

#### Validation Performance

**Test**: Validate typical input (5 fields)

**Target**: < 10ms per validation

**Steps**:

1. Execute tool with valid 5-field input 100 times
2. Measure average validation time (excluding database)
3. Calculate p50, p95, p99

**Success Criteria**:

- ✅ p50 < 5ms
- ✅ p95 < 10ms
- ✅ p99 < 20ms

#### End-to-End Latency

**Test**: Complete tool execution (validation + database insert)

**Target**: < 200ms per execution

**Steps**:

1. Execute tool 100 times with unique inputs
2. Measure total time including database insert
3. Calculate latency percentiles

**Success Criteria**:

- ✅ p50 < 100ms
- ✅ p95 < 200ms
- ✅ p99 < 500ms

**Evidence**:

- Benchmark results table
- Performance graph (if available)

---

### Scenario 9: Concurrent Tool Invocations

**Objective**: Verify system handles concurrent requests

**Test**: 50 concurrent tool executions

**Steps**:

1. Generate tool from configuration
2. Execute tool 50 times in parallel with unique inputs
3. Wait for all executions to complete
4. Verify all succeeded

**Expected**:

- All 50 executions return success
- All 50 rows inserted in database
- No race conditions or deadlocks

**Success Criteria**:

- ✅ All executions complete successfully
- ✅ Database has exactly 50 rows
- ✅ No data corruption
- ✅ Reasonable throughput (> 50 req/sec)

**Evidence**:

- Execution summary (50/50 successful)
- Database row count verification

---

### Scenario 10: Agent Integration

**Objective**: Verify tools work correctly in Mastra agent context

**Setup**:

```typescript
const agent = new Agent({
  name: "Test Agent",
  instructions: "Use log-mood tool to record user mood",
  model: { provider: "ANTHROPIC", name: "claude-3-5-sonnet-20241022" },
  tools: generatedTools,
});
```

**Conversation**:

```
User: I'm feeling happy with high energy today!
```

**Steps**:

1. Send message to agent
2. Observe tool invocation
3. Verify tool called with correct parameters
4. Check database for inserted row

**Expected Behavior**:

1. Agent understands user intent (logging mood)
2. Agent invokes log-mood tool
3. Tool input includes:
   - mood: "happy"
   - energy_level: (inferred or asked)
   - timestamp: (current time)
4. Database row inserted

**Success Criteria**:

- ✅ Agent correctly identifies when to use tool
- ✅ Agent extracts parameters from natural language
- ✅ Tool executes successfully
- ✅ Agent confirms action to user

**Evidence**:

- Agent conversation transcript
- Tool invocation log
- Database verification

---

## Validation Execution Plan

### Phase 1: Configuration & Parsing (Scenarios 1-2)

**Duration**: 30 minutes  
**Focus**: Verify configuration validation logic

### Phase 2: Tool Generation (Scenario 3)

**Duration**: 20 minutes  
**Focus**: Verify tools are generated correctly

### Phase 3: Tool Execution (Scenarios 4-7)

**Duration**: 45 minutes  
**Focus**: Verify runtime behavior (validation, insertion, errors)

### Phase 4: Performance & Concurrency (Scenarios 8-9)

**Duration**: 30 minutes  
**Focus**: Verify performance targets

### Phase 5: Integration Testing (Scenario 10)

**Duration**: 20 minutes  
**Focus**: End-to-end agent workflow

**Total Estimated Time**: 2.5 hours

## Evidence Collection

For each scenario, collect:

1. **Console Output**: Copy/paste of terminal output showing results
2. **Database State**: SQL queries showing inserted/not inserted data
3. **Screenshots**: For UI-based validation (if applicable)
4. **Metrics**: Performance numbers, latency measurements
5. **Logs**: Relevant log entries from execution

Store evidence in: `docs/validations/002-build-a-mastra/`

## Success Criteria Summary

| Category        | Criteria                                   | Target              |
| --------------- | ------------------------------------------ | ------------------- |
| Configuration   | Valid configs load without errors          | 100%                |
| Configuration   | Invalid configs rejected with clear errors | 100%                |
| Tool Generation | Tools generated for all tables             | 100%                |
| Tool Generation | Input schemas match field configs          | 100%                |
| Validation      | Invalid inputs rejected                    | 100%                |
| Validation      | Error messages are actionable              | 100%                |
| Execution       | Valid inputs result in database inserts    | 100%                |
| Execution       | Column mappings work correctly             | 100%                |
| Performance     | Tool generation < 100ms/table              | Yes                 |
| Performance     | Validation < 10ms (p95)                    | Yes                 |
| Performance     | End-to-end < 200ms (p95)                   | Yes                 |
| Concurrency     | 50 concurrent executions succeed           | 100%                |
| Integration     | Agent uses tools correctly                 | Manual verification |

## Post-Validation Actions

1. **Document Issues**: Record any failures or unexpected behavior
2. **Update Tests**: Add contract tests for scenarios that failed
3. **Performance Tuning**: Address any performance bottlenecks discovered
4. **Update Documentation**: Correct any inaccuracies in quickstart or contracts

## Sign-Off

**Validator**: [Name]  
**Date**: [Date]  
**Overall Result**: [ ] PASS / [ ] FAIL  
**Notes**: [Additional observations or issues]
