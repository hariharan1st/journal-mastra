import { describe, it, expect } from "vitest";
import {
  fieldConfigToZodSchema,
  buildTableInputSchema,
} from "../../src/mastra/lib/parsing/field-type-mapper.js";
import type { FieldConfig } from "../../src/mastra/lib/parsing/tool-config-schema.js";
import { z } from "zod";

describe("Field Type Mapper", () => {
  describe("fieldConfigToZodSchema", () => {
    it("should map text field to z.string()", () => {
      const field: FieldConfig = {
        name: "text_field",
        label: "Text Field",
        dataType: "text",
        required: true,
      };

      const schema = fieldConfigToZodSchema(field);
      const result = schema.safeParse("hello");

      expect(result.success).toBe(true);
    });

    it("should apply text length constraints", () => {
      const field: FieldConfig = {
        name: "text_field",
        label: "Text Field",
        dataType: "text",
        required: true,
        minLength: 5,
        maxLength: 10,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse("abc").success).toBe(false); // Too short
      expect(schema.safeParse("abcde").success).toBe(true); // Min length
      expect(schema.safeParse("abcdefghij").success).toBe(true); // Max length
      expect(schema.safeParse("abcdefghijk").success).toBe(false); // Too long
    });

    it("should map integer field to z.number().int()", () => {
      const field: FieldConfig = {
        name: "int_field",
        label: "Integer Field",
        dataType: "integer",
        required: true,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse(42).success).toBe(true);
      expect(schema.safeParse(3.14).success).toBe(false); // Not integer
    });

    it("should apply integer min/max constraints", () => {
      const field: FieldConfig = {
        name: "int_field",
        label: "Integer Field",
        dataType: "integer",
        required: true,
        min: 0,
        max: 100,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse(-1).success).toBe(false); // Below min
      expect(schema.safeParse(0).success).toBe(true); // Min
      expect(schema.safeParse(100).success).toBe(true); // Max
      expect(schema.safeParse(101).success).toBe(false); // Above max
    });

    it("should map numeric field to z.number()", () => {
      const field: FieldConfig = {
        name: "num_field",
        label: "Numeric Field",
        dataType: "numeric",
        required: true,
        precision: 10,
        scale: 2,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse(3.14).success).toBe(true);
      expect(schema.safeParse(42).success).toBe(true);
    });

    it("should apply numeric min/max constraints", () => {
      const field: FieldConfig = {
        name: "num_field",
        label: "Numeric Field",
        dataType: "numeric",
        required: true,
        min: 0.0,
        max: 10.5,
        precision: 10,
        scale: 2,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse(-0.1).success).toBe(false);
      expect(schema.safeParse(0.0).success).toBe(true);
      expect(schema.safeParse(10.5).success).toBe(true);
      expect(schema.safeParse(10.6).success).toBe(false);
    });

    it("should map boolean field to z.boolean()", () => {
      const field: FieldConfig = {
        name: "bool_field",
        label: "Boolean Field",
        dataType: "boolean",
        required: true,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse(true).success).toBe(true);
      expect(schema.safeParse(false).success).toBe(true);
      expect(schema.safeParse("true").success).toBe(false);
    });

    it("should map enum field to z.enum()", () => {
      const field: FieldConfig = {
        name: "enum_field",
        label: "Enum Field",
        dataType: "enum",
        required: true,
        enumValues: ["a", "b", "c"],
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse("a").success).toBe(true);
      expect(schema.safeParse("b").success).toBe(true);
      expect(schema.safeParse("d").success).toBe(false);
    });

    it("should map datetime field to z.string().datetime()", () => {
      const field: FieldConfig = {
        name: "date_field",
        label: "DateTime Field",
        dataType: "datetime",
        required: true,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse("2025-10-05T14:30:00Z").success).toBe(true);
      expect(schema.safeParse("invalid-date").success).toBe(false);
    });

    it("should apply datetime range constraints", () => {
      const field: FieldConfig = {
        name: "date_field",
        label: "DateTime Field",
        dataType: "datetime",
        required: true,
        minDate: "2025-01-01T00:00:00Z",
        maxDate: "2025-12-31T23:59:59Z",
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse("2024-12-31T23:59:59Z").success).toBe(false); // Before min
      expect(schema.safeParse("2025-06-15T12:00:00Z").success).toBe(true); // Within range
      expect(schema.safeParse("2026-01-01T00:00:00Z").success).toBe(false); // After max
    });

    it("should map json field to z.record()", () => {
      const field: FieldConfig = {
        name: "json_field",
        label: "JSON Field",
        dataType: "json",
        required: true,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse({ key: "value" }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(true);
    });

    it("should make field optional when required=false", () => {
      const field: FieldConfig = {
        name: "optional_field",
        label: "Optional Field",
        dataType: "text",
        required: false,
      };

      const schema = fieldConfigToZodSchema(field);

      expect(schema.safeParse(undefined).success).toBe(true);
      expect(schema.safeParse("value").success).toBe(true);
    });

    it("should apply default value", () => {
      const field: FieldConfig = {
        name: "field_with_default",
        label: "Field With Default",
        dataType: "text",
        required: false,
        defaultValue: "default_value",
      };

      const schema = fieldConfigToZodSchema(field);
      const result = schema.parse(undefined);

      expect(result).toBe("default_value");
    });
  });

  describe("buildTableInputSchema", () => {
    it("should build schema from multiple fields", () => {
      const fields: FieldConfig[] = [
        {
          name: "field1",
          label: "Field 1",
          dataType: "text",
          required: true,
        },
        {
          name: "field2",
          label: "Field 2",
          dataType: "integer",
          required: true,
        },
      ];

      const schema = buildTableInputSchema(fields);

      const result = schema.safeParse({
        field1: "hello",
        field2: 42,
      });

      expect(result.success).toBe(true);
    });

    it("should reject unknown fields (strict mode)", () => {
      const fields: FieldConfig[] = [
        {
          name: "field1",
          label: "Field 1",
          dataType: "text",
          required: true,
        },
      ];

      const schema = buildTableInputSchema(fields);

      const result = schema.safeParse({
        field1: "hello",
        unknown_field: "should_fail", // Unknown field
      });

      expect(result.success).toBe(false);
    });

    it("should validate all field constraints", () => {
      const fields: FieldConfig[] = [
        {
          name: "mood",
          label: "Mood",
          dataType: "enum",
          required: true,
          enumValues: ["happy", "sad"],
        },
        {
          name: "energy",
          label: "Energy",
          dataType: "integer",
          required: true,
          min: 1,
          max: 10,
        },
      ];

      const schema = buildTableInputSchema(fields);

      // Valid input
      expect(schema.safeParse({ mood: "happy", energy: 5 }).success).toBe(true);

      // Invalid enum
      expect(schema.safeParse({ mood: "excited", energy: 5 }).success).toBe(
        false
      );

      // Out of range
      expect(schema.safeParse({ mood: "happy", energy: 15 }).success).toBe(
        false
      );
    });
  });
});
