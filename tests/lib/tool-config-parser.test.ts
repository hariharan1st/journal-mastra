import { describe, it, expect } from "vitest";
import {
  loadToolConfiguration,
  safeLoadToolConfiguration,
  ConfigError,
} from "../../src/mastra/lib/parsing/tool-config-parser.js";

describe("Tool Config Parser", () => {
  describe("loadToolConfiguration", () => {
    it("should parse valid JSON string", () => {
      const jsonString = JSON.stringify({
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "A test tool",
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
      });

      const result = loadToolConfiguration(jsonString);
      expect(result.version).toBe("1.0.0");
      expect(result.tables).toHaveLength(1);
    });

    it("should accept object input", () => {
      const config = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "A test tool",
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

      const result = loadToolConfiguration(config);
      expect(result.version).toBe("1.0.0");
    });

    it("should throw ConfigError for malformed JSON", () => {
      const malformedJson = "{ invalid json }";

      expect(() => loadToolConfiguration(malformedJson)).toThrow(ConfigError);
      expect(() => loadToolConfiguration(malformedJson)).toThrow(
        /Failed to parse/
      );
    });

    it("should throw ConfigError for invalid semver version", () => {
      const config = {
        version: "1.0", // Not semver
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
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

      expect(() => loadToolConfiguration(config)).toThrow(ConfigError);
    });

    it("should throw ConfigError for invalid snake_case table name", () => {
      const config = {
        version: "1.0.0",
        tables: [
          {
            tableName: "InvalidTableName", // Should be snake_case
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
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

      expect(() => loadToolConfiguration(config)).toThrow(ConfigError);
      expect(() => loadToolConfiguration(config)).toThrow(/snake_case/);
    });

    it("should validate unique field names within table", () => {
      const config = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
            fields: [
              {
                name: "duplicate",
                label: "Field 1",
                dataType: "text",
                required: true,
              },
              {
                name: "duplicate", // Duplicate!
                label: "Field 2",
                dataType: "text",
                required: true,
              },
            ],
          },
        ],
      };

      expect(() => loadToolConfiguration(config)).toThrow(ConfigError);
      expect(() => loadToolConfiguration(config)).toThrow(/unique/);
    });

    it("should validate unique tool IDs across tables", () => {
      const config = {
        version: "1.0.0",
        tables: [
          {
            tableName: "table1",
            toolId: "duplicate-id",
            displayName: "Table 1",
            description: "First table",
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
            displayName: "Table 2",
            description: "Second table",
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

      expect(() => loadToolConfiguration(config)).toThrow(ConfigError);
    });
  });

  describe("safeLoadToolConfiguration", () => {
    it("should return success object for valid configuration", () => {
      const config = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
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

      const result = safeLoadToolConfiguration(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.config.version).toBe("1.0.0");
      }
    });

    it("should return error object for invalid configuration", () => {
      const config = {
        version: "invalid",
        tables: [],
      };

      const result = safeLoadToolConfiguration(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe("string");
      }
    });

    it("should include ZodError in error result", () => {
      const config = {
        version: "1.0.0",
        tables: [], // Invalid: empty array
      };

      const result = safeLoadToolConfiguration(config);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.zodError).toBeDefined();
      }
    });
  });
});
