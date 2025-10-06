import { describe, it, expect } from "vitest";
import {
  loadToolConfiguration,
  ConfigError,
} from "../../src/mastra/lib/parsing/tool-config-parser.js";
import type { ToolConfiguration } from "../../src/mastra/lib/parsing/tool-config-schema.js";

describe("Tool Configuration Schema Contract", () => {
  describe("Valid Configuration", () => {
    it("should load a valid configuration successfully", () => {
      const validConfig: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test Tool",
            description: "This is a test tool for validation",
            fields: [
              {
                name: "test_field",
                label: "Test Field",
                dataType: "text",
                required: true,
              },
            ],
          },
        ],
      };

      const result = loadToolConfiguration(validConfig);
      expect(result).toBeDefined();
      expect(result.version).toBe("1.0.0");
      expect(result.tables).toHaveLength(1);
    });

    it("should accept all field types", () => {
      const config: ToolConfiguration = {
        version: "1.0.0",
        tables: [
          {
            tableName: "all_types_table",
            toolId: "all-types",
            displayName: "All Types",
            description: "Table with all field types",
            fields: [
              {
                name: "text_field",
                label: "Text",
                dataType: "text",
                required: true,
                maxLength: 100,
              },
              {
                name: "int_field",
                label: "Integer",
                dataType: "integer",
                required: true,
                min: 0,
                max: 100,
              },
              {
                name: "num_field",
                label: "Numeric",
                dataType: "numeric",
                required: false,
                min: 0.0,
                max: 10.5,
                precision: 10,
                scale: 2,
              },
              {
                name: "bool_field",
                label: "Boolean",
                dataType: "boolean",
                required: false,
              },
              {
                name: "enum_field",
                label: "Enum",
                dataType: "enum",
                required: true,
                enumValues: ["a", "b", "c"],
              },
              {
                name: "date_field",
                label: "DateTime",
                dataType: "datetime",
                required: false,
              },
              {
                name: "json_field",
                label: "JSON",
                dataType: "json",
                required: false,
              },
            ],
          },
        ],
      };

      const result = loadToolConfiguration(config);
      expect(result.tables[0].fields).toHaveLength(7);
    });
  });

  describe("Invalid Configurations", () => {
    it("should reject configuration with invalid version format", () => {
      const invalidConfig = {
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

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });

    it("should reject configuration with missing required fields", () => {
      const invalidConfig = {
        version: "1.0.0",
        tables: [
          {
            // Missing tableName
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
            fields: [],
          },
        ],
      };

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });

    it("should reject configuration with invalid table name format", () => {
      const invalidConfig = {
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

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });

    it("should reject configuration with duplicate field names", () => {
      const invalidConfig = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
            fields: [
              {
                name: "duplicate_field",
                label: "Field 1",
                dataType: "text",
                required: true,
              },
              {
                name: "duplicate_field", // Duplicate!
                label: "Field 2",
                dataType: "integer",
                required: true,
              },
            ],
          },
        ],
      };

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });

    it("should reject configuration with duplicate tool IDs", () => {
      const invalidConfig = {
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

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });

    it("should reject enum field without values", () => {
      const invalidConfig = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
            fields: [
              {
                name: "enum_field",
                label: "Enum Field",
                dataType: "enum",
                required: true,
                enumValues: [], // Empty!
              },
            ],
          },
        ],
      };

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });
  });

  describe("Field Constraints", () => {
    it("should reject text field with invalid length constraints", () => {
      const invalidConfig = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
            fields: [
              {
                name: "text_field",
                label: "Text",
                dataType: "text",
                required: true,
                minLength: 100,
                maxLength: 50, // max < min!
              },
            ],
          },
        ],
      };

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });

    it("should reject integer field with invalid range", () => {
      const invalidConfig = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
            fields: [
              {
                name: "int_field",
                label: "Integer",
                dataType: "integer",
                required: true,
                min: 100,
                max: 50, // max < min!
              },
            ],
          },
        ],
      };

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });

    it("should reject enum field with invalid default value", () => {
      const invalidConfig = {
        version: "1.0.0",
        tables: [
          {
            tableName: "test_table",
            toolId: "test-tool",
            displayName: "Test",
            description: "Test description",
            fields: [
              {
                name: "enum_field",
                label: "Enum",
                dataType: "enum",
                required: true,
                enumValues: ["a", "b", "c"],
                defaultValue: "d", // Not in enum values!
              },
            ],
          },
        ],
      };

      expect(() => loadToolConfiguration(invalidConfig)).toThrow(ConfigError);
    });
  });

  describe("JSON String Parsing", () => {
    it("should parse valid JSON string", () => {
      const jsonString = JSON.stringify({
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
      });

      const result = loadToolConfiguration(jsonString);
      expect(result).toBeDefined();
    });

    it("should reject malformed JSON string", () => {
      const malformedJson = '{ "version": "1.0.0", invalid }';

      expect(() => loadToolConfiguration(malformedJson)).toThrow(ConfigError);
    });
  });
});
