# Quickstart Guide: Dynamic Configuration-Driven Mastra Agent

**Feature**: 002-build-a-mastra  
**Date**: 2025-10-05  
**Audience**: Developers integrating dynamic tool system

## Overview

This guide walks through setting up and using the dynamic configuration-driven agent system to create custom database tools from configuration files.

## Prerequisites

- Node.js 20.9 or higher
- PostgreSQL 15+ with pgvector extension
- Existing journal-mastra project setup
- Prisma schema with target tables defined

## Step 1: Define Your Configuration

Create a configuration file defining your tables and fields:

```json
// config/mood-tracker.json
{
  "version": "1.0.0",
  "metadata": {
    "name": "Mood Tracker",
    "description": "Track daily mood and energy levels",
    "author": "your-name",
    "createdAt": "2025-10-05T00:00:00Z",
    "tags": ["health", "mood"]
  },
  "tables": [
    {
      "tableName": "mood_entries",
      "toolId": "log-mood",
      "displayName": "Log Mood Entry",
      "description": "Record user's mood and energy level for a specific time",
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
          "label": "Current Mood",
          "dataType": "enum",
          "required": true,
          "enumValues": ["happy", "sad", "neutral", "anxious", "excited"]
        },
        {
          "name": "energy_level",
          "label": "Energy Level (1-10)",
          "dataType": "integer",
          "required": true,
          "min": 1,
          "max": 10
        },
        {
          "name": "notes",
          "label": "Additional Notes",
          "dataType": "text",
          "required": false,
          "maxLength": 500
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

## Step 2: Create Database Table

Ensure your table exists in the database. You can use Prisma migrations or the DynamicTableManager service:

### Option A: Prisma Migration (Recommended)

Add to `prisma/schema.prisma`:

```prisma
model MoodEntry {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id") @db.Text
  mood       String   @db.Text
  energyLevel Int     @map("energy_level")
  notes      String?  @db.Text
  timestamp  DateTime @db.Timestamptz
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz

  @@unique([userId, timestamp])
  @@map("mood_entries")
}
```

Run migration:

```bash
npx prisma migrate dev --name add_mood_entries
```

### Option B: Dynamic Table Manager (For Truly Dynamic Tables)

```typescript
import { DynamicTableManager } from "./src/mastra/services/dynamic-table-manager";
import { getPrismaClient } from "./src/mastra/lib/prisma-client";

const prisma = getPrismaClient();
const tableManager = new DynamicTableManager(prisma);

await tableManager.planAndExecute({
  metricSlug: "mood_entry",
  displayName: "Mood Entry",
  fields: [
    { name: "user_id", dataType: "text", required: true },
    { name: "mood", dataType: "text", required: true },
    { name: "energy_level", dataType: "integer", required: true },
    { name: "notes", dataType: "text", required: false },
    { name: "timestamp", dataType: "datetime", required: true },
  ],
});
```

## Step 3: Load Configuration and Generate Tools

Create an agent with dynamic tools:

```typescript
// src/mastra/agents/mood-tracker-agent.ts
import { Agent } from "@mastra/core/agents";
import { DynamicToolGenerator } from "../services/dynamic-tool-generator";
import { loadToolConfiguration } from "../lib/parsing/tool-config-parser";
import fs from "fs/promises";

// Load configuration
const configJson = await fs.readFile("config/mood-tracker.json", "utf-8");
const configuration = loadToolConfiguration(configJson);

// Generate tools
const toolGenerator = new DynamicToolGenerator();
const tools = await toolGenerator.generateTools(configuration);

// Create agent
export const moodTrackerAgent = new Agent({
  name: "Mood Tracker",
  instructions: `You are a helpful assistant that tracks user mood and energy levels.
When a user shares how they're feeling, use the log-mood tool to record it.
Always ask for mood and energy level if not provided.`,
  model: {
    provider: "ANTHROPIC",
    name: "claude-3-5-sonnet-20241022",
    toolChoice: "auto",
  },
  tools,
});
```

## Step 4: Use the Agent

### Via Mastra API

```typescript
import { moodTrackerAgent } from "./src/mastra/agents/mood-tracker-agent";

const result = await moodTrackerAgent.generate([
  {
    role: "user",
    content: "I'm feeling happy today with high energy! Energy level is 8.",
  },
]);

// Agent will automatically invoke log-mood tool with:
// {
//   user_id: "current_user_id", // from context
//   mood: "happy",
//   energy_level: 8,
//   timestamp: "2025-10-05T14:30:00Z"
// }
```

### Direct Tool Invocation (Testing)

```typescript
import { DynamicToolGenerator } from "./src/mastra/services/dynamic-tool-generator";

const toolGenerator = new DynamicToolGenerator();
const tools = await toolGenerator.generateTools(configuration);
const logMoodTool = tools.find((t) => t.id === "log-mood");

const result = await logMoodTool.execute({
  user_id: "user_123",
  mood: "happy",
  energy_level: 8,
  notes: "Great day!",
  timestamp: new Date().toISOString(),
});

console.log(result);
// {
//   success: true,
//   data: {
//     id: "550e8400-e29b-41d4-a716-446655440000",
//     rowCount: 1,
//     message: "Successfully logged mood entry for user_123 at 2025-10-05T14:30:00Z"
//   }
// }
```

## Step 5: Handle Validation Errors

The system provides detailed error messages when validation fails:

```typescript
// Missing required field
const result = await logMoodTool.execute({
  user_id: "user_123",
  mood: "happy",
  // Missing: energy_level, timestamp
});

// Returns:
// {
//   success: false,
//   error: {
//     type: "VALIDATION_ERROR",
//     message: "Field 'energy_level' is required but was not provided",
//     details: {
//       field: "energy_level",
//       expected: "integer between 1 and 10",
//       code: "invalid_type"
//     }
//   }
// }
```

```typescript
// Invalid enum value
const result = await logMoodTool.execute({
  user_id: "user_123",
  mood: "ecstatic", // Not in enum values
  energy_level: 8,
  timestamp: new Date().toISOString(),
});

// Returns:
// {
//   success: false,
//   error: {
//     type: "VALIDATION_ERROR",
//     message: "Field 'mood' must be one of: happy, sad, neutral, anxious, excited",
//     details: {
//       field: "mood",
//       expected: "one of: happy, sad, neutral, anxious, excited",
//       received: "ecstatic",
//       code: "invalid_enum_value"
//     }
//   }
// }
```

## Advanced Usage

### Multiple Tables in One Configuration

```json
{
  "version": "1.0.0",
  "tables": [
    {
      "tableName": "mood_entries",
      "toolId": "log-mood"
      // ... mood fields
    },
    {
      "tableName": "sleep_entries",
      "toolId": "log-sleep",
      "displayName": "Log Sleep Entry",
      "description": "Record sleep duration and quality",
      "fields": [
        {
          "name": "user_id",
          "label": "User ID",
          "dataType": "text",
          "required": true
        },
        {
          "name": "hours_slept",
          "label": "Hours Slept",
          "dataType": "numeric",
          "required": true,
          "min": 0,
          "max": 24
        },
        {
          "name": "quality",
          "label": "Sleep Quality",
          "dataType": "enum",
          "required": true,
          "enumValues": ["poor", "fair", "good", "excellent"]
        },
        {
          "name": "timestamp",
          "label": "Wake Time",
          "dataType": "datetime",
          "required": true
        }
      ]
    }
  ]
}
```

### Column Mappings

Use when logical field names differ from database columns:

```json
{
  "tableName": "mood_entries",
  "toolId": "log-mood",
  "fields": [
    {
      "name": "user_id",
      "label": "User ID",
      "dataType": "text",
      "required": true
    }
  ],
  "columnMappings": {
    "user_id": "telegram_user_id"
  }
}
```

Now `user_id` in tool input maps to `telegram_user_id` column in database.

### Default Values

Provide defaults for optional fields:

```json
{
  "name": "is_public",
  "label": "Public Entry",
  "dataType": "boolean",
  "required": false,
  "defaultValue": false
}
```

### JSON Fields for Flexible Data

```json
{
  "name": "metadata",
  "label": "Additional Metadata",
  "dataType": "json",
  "required": false,
  "defaultValue": {}
}
```

## Troubleshooting

### Error: "Table 'mood_entries' does not exist in database schema"

**Solution**: Create the table using Prisma migrations or DynamicTableManager before loading configuration.

### Error: "Field names must be unique within table"

**Solution**: Check for duplicate field names in your configuration. Field names are case-sensitive.

### Error: "Configuration validation failed: version must match semver format"

**Solution**: Ensure version follows semantic versioning (e.g., "1.0.0", not "1.0" or "v1.0.0").

### Tool Not Registering

**Issue**: Tool ID conflicts with existing tool.

**Solution**: Use unique tool IDs. Check all tools in your agent to avoid conflicts.

### Slow Tool Execution

**Issue**: Large configuration with many tables.

**Solution**:

- Tools are cached after first generation
- Consider splitting into multiple agents if you have 50+ tables
- Ensure database indexes exist for frequently queried columns

## Best Practices

1. **Start Simple**: Begin with one table and a few fields, then expand
2. **Validate Early**: Load and validate configuration at application startup, not on first request
3. **Use Enums**: Prefer enum fields over free text when values are constrained
4. **Set Constraints**: Define min/max, length limits to prevent invalid data
5. **Meaningful IDs**: Use descriptive tool IDs that indicate purpose (e.g., "log-mood" not "tool1")
6. **Document Configs**: Use metadata section to document purpose and author
7. **Version Configs**: Increment version when making breaking changes to configuration structure
8. **Test Thoroughly**: Write contract tests for each tool before deploying

## Next Steps

- **Multiple Configurations**: Load different configurations for different use cases
- **Dynamic Updates**: Implement configuration hot-reloading (future feature)
- **Custom Validation**: Extend FieldConfig with custom validation rules
- **Relationships**: Add support for foreign key relationships between tables (future feature)
- **Bulk Operations**: Batch multiple tool executions in single transaction (future feature)

## Support

- **Documentation**: See `specs/002-build-a-mastra/` for detailed specs and contracts
- **Examples**: Check `tests/contracts/` for contract test examples
- **Issues**: Report bugs or request features via project issue tracker
