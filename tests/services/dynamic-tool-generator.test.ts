import { describe, it, expect, beforeEach } from "vitest";
import { DynamicToolGenerator } from "../../src/mastra/services/dynamic-tool-generator.js";
import type { ToolConfiguration } from "../../src/mastra/lib/parsing/tool-config-schema.js";

describe("DynamicToolGenerator", () => {
  let generator: DynamicToolGenerator;

  beforeEach(() => {
    generator = new DynamicToolGenerator();
    generator.clearCache(); // Clear cache before each test
  });

  describe("generateTools", () => {
    it("should generate tool from single table configuration", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "A test tool for validation",
            fields: [
              {
                name: "field1",
                label: "Field 1",
                dataType: "text",
                required: true,
              },
            ],
          },
        ],
      };

      const tools = await generator.generateTools(config);

      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe("test-tool");
    });

    it("should generate multiple tools from multi-table configuration", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "table1",
            toolId: "tool-1",
            displayName: "Tool 1",
            description: "First tool",
            fields: [
              {
                name: "field1",
                label: "Field 1",
                dataType: "text",
                required: true,
              },
            ],
          },
          {
            tableName: "table2",
            toolId: "tool-2",
            displayName: "Tool 2",
            description: "Second tool",
            fields: [
              {
                name: "field2",
                label: "Field 2",
                dataType: "integer",
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

    it("should throw error for duplicate tool IDs", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "table1",
            toolId: "duplicate-id",
            displayName: "Tool 1",
            description: "First tool",
            fields: [
              {
                name: "field1",
                label: "Field 1",
                dataType: "text",
                required: true,
              },
            ],
          },
          {
            tableName: "table2",
            toolId: "duplicate-id", // Duplicate!
            displayName: "Tool 2",
            description: "Second tool",
            fields: [
              {
                name: "field2",
                label: "Field 2",
                dataType: "text",
                required: true,
              },
            ],
          },
        ],
      };

      await expect(generator.generateTools(config)).rejects.toThrow(
        /Duplicate tool ID/
      );
    });

    it("should cache generated schemas", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test caching",
            fields: [
              {
                name: "field1",
                label: "Field 1",
                dataType: "text",
                required: true,
              },
            ],
          },
        ],
      };

      // Generate tools twice
      const tools1 = await generator.generateTools(config);
      const tools2 = await generator.generateTools(config);

      // Should generate successfully both times
      expect(tools1).toHaveLength(1);
      expect(tools2).toHaveLength(1);
    });
  });

  describe("clearCache", () => {
    it("should clear schema cache", async () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "Test cache clearing",
            fields: [
              {
                name: "field1",
                label: "Field 1",
                dataType: "text",
                required: true,
              },
            ],
          },
        ],
      };

      await generator.generateTools(config);
      generator.clearCache();

      // Should still work after cache clear
      const tools = await generator.generateTools(config);
      expect(tools).toHaveLength(1);
    });
  });
});
