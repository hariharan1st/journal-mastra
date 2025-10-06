import { describe, it, expect } from "vitest";
import {
  applyColumnMappings,
  reverseColumnMappings,
  validateColumnMappings,
} from "../../src/mastra/lib/parsing/column-mapper.js";

describe("Column Mapper", () => {
  describe("applyColumnMappings", () => {
    it("should return fields as-is when no mappings provided", () => {
      const fields = {
        field1: "value1",
        field2: "value2",
      };

      const result = applyColumnMappings(fields);

      expect(result).toEqual(fields);
    });

    it("should map logical names to physical names", () => {
      const fields = {
        logicalField: "value1",
        anotherField: "value2",
      };

      const mappings = {
        logicalField: "physical_field",
        anotherField: "another_physical_field",
      };

      const result = applyColumnMappings(fields, mappings);

      expect(result).toEqual({
        physical_field: "value1",
        another_physical_field: "value2",
      });
    });

    it("should preserve unmapped fields", () => {
      const fields = {
        mappedField: "value1",
        unmappedField: "value2",
      };

      const mappings = {
        mappedField: "physical_field",
      };

      const result = applyColumnMappings(fields, mappings);

      expect(result).toEqual({
        physical_field: "value1",
        unmappedField: "value2",
      });
    });
  });

  describe("reverseColumnMappings", () => {
    it("should reverse physical-to-logical mappings", () => {
      const mappings = {
        logical1: "physical1",
        logical2: "physical2",
      };

      const reversed = reverseColumnMappings(mappings);

      expect(reversed).toEqual({
        physical1: "logical1",
        physical2: "logical2",
      });
    });
  });

  describe("validateColumnMappings", () => {
    it("should not throw for valid mappings", () => {
      const fieldNames = ["field1", "field2"];
      const mappings = {
        field1: "physical1",
        field2: "physical2",
      };

      expect(() => validateColumnMappings(fieldNames, mappings)).not.toThrow();
    });

    it("should throw for mapping to non-existent field", () => {
      const fieldNames = ["field1", "field2"];
      const mappings = {
        field1: "physical1",
        nonExistentField: "physical2", // Invalid!
      };

      expect(() => validateColumnMappings(fieldNames, mappings)).toThrow(
        /unknown field/
      );
    });

    it("should not throw when no mappings provided", () => {
      const fieldNames = ["field1", "field2"];

      expect(() => validateColumnMappings(fieldNames)).not.toThrow();
    });
  });
});
