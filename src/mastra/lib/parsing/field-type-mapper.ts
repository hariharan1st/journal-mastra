import { z, ZodTypeAny } from "zod";
import type { FieldConfig } from "./tool-config-schema.js";

/**
 * Map FieldConfig to corresponding Zod schema with all constraints
 *
 * @param field - Field configuration from tool config
 * @returns Zod schema for runtime validation
 */
export function fieldConfigToZodSchema(field: FieldConfig): ZodTypeAny {
  let schema: ZodTypeAny;

  switch (field.dataType) {
    case "text": {
      let textSchema = z.string();

      if (field.minLength !== undefined) {
        textSchema = textSchema.min(
          field.minLength,
          `Must be at least ${field.minLength} characters`
        );
      }

      if (field.maxLength !== undefined) {
        textSchema = textSchema.max(
          field.maxLength,
          `Must be at most ${field.maxLength} characters`
        );
      }

      schema = textSchema;
      break;
    }

    case "integer": {
      let intSchema = z.number().int(`Must be an integer`);

      if (field.min !== undefined) {
        intSchema = intSchema.min(field.min, `Must be at least ${field.min}`);
      }

      if (field.max !== undefined) {
        intSchema = intSchema.max(field.max, `Must be at most ${field.max}`);
      }

      schema = intSchema;
      break;
    }

    case "numeric": {
      let numSchema = z.number();

      if (field.min !== undefined) {
        numSchema = numSchema.min(field.min, `Must be at least ${field.min}`);
      }

      if (field.max !== undefined) {
        numSchema = numSchema.max(field.max, `Must be at most ${field.max}`);
      }

      // Note: Zod doesn't have built-in precision/scale validation
      // This is handled at the database level via Prisma schema
      schema = numSchema;
      break;
    }

    case "boolean": {
      schema = z.boolean();
      break;
    }

    case "enum": {
      if (field.enumValues.length === 0) {
        throw new Error(
          `Enum field '${field.name}' must have at least one value`
        );
      }

      // Create tuple type for Zod enum
      const [first, ...rest] = field.enumValues;
      schema = z.enum([first, ...rest] as [string, ...string[]]);
      break;
    }

    case "datetime": {
      let dateSchema = z.string().datetime(`Must be valid ISO 8601 datetime`);

      // Note: Zod doesn't have built-in date range validation for string datetimes
      // We can add custom refinements if needed
      if (field.minDate || field.maxDate) {
        dateSchema = dateSchema.refine(
          (value) => {
            const date = new Date(value);
            if (field.minDate && date < new Date(field.minDate)) {
              return false;
            }
            if (field.maxDate && date > new Date(field.maxDate)) {
              return false;
            }
            return true;
          },
          {
            message: `Must be between ${field.minDate || "any date"} and ${
              field.maxDate || "any date"
            }`,
          }
        );
      }

      schema = dateSchema;
      break;
    }

    case "json": {
      schema = z.record(z.string(), z.any());
      break;
    }

    default: {
      // TypeScript exhaustiveness check
      const exhaustiveCheck: never = field;
      throw new Error(
        `Unknown field type: ${(exhaustiveCheck as any).dataType}`
      );
    }
  }

  // Handle optional fields
  if (!field.required) {
    schema = schema.optional();
  }

  // Handle default values
  if (field.defaultValue !== undefined) {
    schema = schema.default(field.defaultValue);
  }

  return schema;
}

/**
 * Build complete input schema for a table from its field configurations
 *
 * @param fields - Array of field configurations
 * @returns Zod object schema for table input validation
 */
export function buildTableInputSchema(
  fields: FieldConfig[]
): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of fields) {
    shape[field.name] = fieldConfigToZodSchema(field);
  }

  // Use strict() to reject unknown fields
  return z.object(shape).strict();
}
