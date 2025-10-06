import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { DynamicToolGenerator } from "../../src/mastra/services/dynamic-tool-generator.js";
import type { ToolConfiguration } from "../../src/mastra/lib/parsing/tool-config-schema.js";
import { getPrismaClient } from "../../src/mastra/lib/prisma-client.js";

// NOTE: These tests require PostgreSQL database connection and test tables
// Run with: DATABASE_URL=postgresql://... npm test

describe("Dynamic Tool Execution Contract", () => {
  const prisma = getPrismaClient();
  let generator: DynamicToolGenerator;
  let testTableExists = false;

  beforeAll(async () => {
    generator = new DynamicToolGenerator();

    // Check if test table exists, create if not
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS test_dynamic_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          mood TEXT NOT NULL,
          energy_level INTEGER NOT NULL,
          notes TEXT,
          has_medication BOOLEAN DEFAULT false,
          timestamp TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      testTableExists = true;
    } catch (error) {
      console.warn(
        "Warning: Could not create test table. Database integration tests will be skipped."
      );
      testTableExists = false;
    }
  });

  afterAll(async () => {
    // Clean up test table
    if (testTableExists) {
      try {
        await prisma.$executeRawUnsafe(
          `DROP TABLE IF EXISTS test_dynamic_entries`
        );
      } catch (error) {
        console.warn("Warning: Could not drop test table");
      }
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clear test data before each test
    if (testTableExists) {
      await prisma.$executeRawUnsafe(`DELETE FROM test_dynamic_entries`);
    }
  });

  describe("Tool Generation", () => {
    it("should generate tool from valid configuration", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "test-log-entry",
            displayName: "Test Entry Logger",
            description: "Test tool for logging entries",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
                maxLength: 50,
              },
              {
                name: "mood",
                label: "Mood",
                dataType: "enum",
                required: true,
                enumValues: ["happy", "sad", "neutral"],
              },
              {
                name: "energy_level",
                label: "Energy Level",
                dataType: "integer",
                required: true,
                min: 1,
                max: 10,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);

      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe("test-log-entry");
    });

    it("should generate multiple tools from multi-table configuration", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "tool-1",
            displayName: "Tool 1",
            description: "First test tool",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
              },
            ],
          },
          {
            tableName: "test_dynamic_entries",
            toolId: "tool-2",
            displayName: "Tool 2",
            description: "Second test tool",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);

      expect(tools).toHaveLength(2);
      expect(tools[0].id).toBe("tool-1");
      expect(tools[1].id).toBe("tool-2");
    });
  });

  describe("Tool Invocation", () => {
    it.skip("should successfully execute tool with valid inputs (requires database)", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test tool execution",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
              },
              {
                name: "mood",
                label: "Mood",
                dataType: "enum",
                required: true,
                enumValues: ["happy", "sad", "neutral"],
              },
              {
                name: "energy_level",
                label: "Energy",
                dataType: "integer",
                required: true,
                min: 1,
                max: 10,
              },
              {
                name: "timestamp",
                label: "Timestamp",
                dataType: "datetime",
                required: true,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);
      const tool = tools[0];

      const result = await tool.execute({
        user_id: "test_user_123",
        mood: "happy",
        energy_level: 8,
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rowCount).toBe(1);
        expect(result.data.id).toBeDefined();
        expect(result.data.message).toContain("Successfully inserted");
      }
    });

    it.skip("should reject invalid enum value (requires database)", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test validation",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
              },
              {
                name: "mood",
                label: "Mood",
                dataType: "enum",
                required: true,
                enumValues: ["happy", "sad", "neutral"],
              },
              {
                name: "energy_level",
                label: "Energy",
                dataType: "integer",
                required: true,
              },
              {
                name: "timestamp",
                label: "Timestamp",
                dataType: "datetime",
                required: true,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);
      const tool = tools[0];

      const result = await tool.execute({
        user_id: "test_user",
        mood: "invalid_mood", // Not in enum values
        energy_level: 5,
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("VALIDATION_ERROR");
      }
    });

    it.skip("should reject out-of-range integer value (requires database)", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test validation",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
              },
              {
                name: "mood",
                label: "Mood",
                dataType: "enum",
                required: true,
                enumValues: ["happy", "sad", "neutral"],
              },
              {
                name: "energy_level",
                label: "Energy",
                dataType: "integer",
                required: true,
                min: 1,
                max: 10,
              },
              {
                name: "timestamp",
                label: "Timestamp",
                dataType: "datetime",
                required: true,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);
      const tool = tools[0];

      const result = await tool.execute({
        user_id: "test_user",
        mood: "happy",
        energy_level: 15, // Out of range
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("VALIDATION_ERROR");
        expect(result.error.message).toContain("energy_level");
      }
    });

    it.skip("should reject missing required field (requires database)", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test validation",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
              },
              {
                name: "mood",
                label: "Mood",
                dataType: "enum",
                required: true,
                enumValues: ["happy", "sad", "neutral"],
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);
      const tool = tools[0];

      const result = await tool.execute({
        user_id: "test_user",
        // Missing required 'mood' field
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("Response Format", () => {
    it.skip("should return ToolExecutionSuccess with correct structure (requires database)", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test response format",
            fields: [
              {
                name: "user_id",
                label: "User ID",
                dataType: "text",
                required: true,
              },
              {
                name: "mood",
                label: "Mood",
                dataType: "text",
                required: true,
              },
              {
                name: "energy_level",
                label: "Energy",
                dataType: "integer",
                required: true,
              },
              {
                name: "timestamp",
                label: "Timestamp",
                dataType: "datetime",
                required: true,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);
      const tool = tools[0];

      const result = await tool.execute({
        user_id: "test_user",
        mood: "happy",
        energy_level: 7,
        timestamp: new Date().toISOString(),
      });

      expect(result).toHaveProperty("success");
      if (result.success) {
        expect(result).toHaveProperty("data");
        expect(result.data).toHaveProperty("id");
        expect(result.data).toHaveProperty("rowCount");
        expect(result.data).toHaveProperty("message");
        expect(typeof result.data.rowCount).toBe("number");
        expect(typeof result.data.message).toBe("string");
      }
    });

    it.skip("should return ToolExecutionError with correct structure on validation failure (requires database)", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_dynamic_entries",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test error format",
            fields: [
              {
                name: "energy_level",
                label: "Energy",
                dataType: "integer",
                required: true,
                min: 1,
                max: 10,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);
      const tool = tools[0];

      const result = await tool.execute({
        energy_level: 100, // Out of range
      });

      expect(result).toHaveProperty("success");
      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result).toHaveProperty("error");
        expect(result.error).toHaveProperty("type");
        expect(result.error).toHaveProperty("message");
        expect(result.error.type).toBe("VALIDATION_ERROR");
        expect(typeof result.error.message).toBe("string");
      }
    });
  });
});
