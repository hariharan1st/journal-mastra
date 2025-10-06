import { z } from "zod";

// ========================================
// Field Configuration Schemas
// ========================================

// Base field configuration shared by all field types
const BaseFieldConfigSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, "Field name must be snake_case")
    .min(1)
    .max(63),
  label: z.string().min(1).max(100),
  required: z.boolean(),
});

// Text field with optional length constraints
export const TextFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("text"),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  defaultValue: z.string().optional(),
}).refine(
  (data) => {
    if (data.minLength !== undefined && data.maxLength !== undefined) {
      return data.maxLength >= data.minLength;
    }
    return true;
  },
  { message: "maxLength must be >= minLength" }
);

// Integer field with optional min/max constraints
export const IntegerFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("integer"),
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  defaultValue: z.number().int().optional(),
}).refine(
  (data) => {
    if (data.min !== undefined && data.max !== undefined) {
      return data.max >= data.min;
    }
    return true;
  },
  { message: "max must be >= min" }
);

// Numeric (decimal) field with optional precision/scale
export const NumericFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("numeric"),
  min: z.number().optional(),
  max: z.number().optional(),
  precision: z.number().int().min(1).max(38).optional().default(10),
  scale: z.number().int().min(0).max(37).optional().default(2),
  defaultValue: z.number().optional(),
}).refine(
  (data) => {
    if (data.min !== undefined && data.max !== undefined) {
      return data.max >= data.min;
    }
    return true;
  },
  { message: "max must be >= min" }
);

// Boolean field
export const BooleanFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("boolean"),
  defaultValue: z.boolean().optional(),
});

// Enum field with predefined values
export const EnumFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("enum"),
  enumValues: z
    .array(z.string().min(1))
    .min(1, "At least one enum value required")
    .max(100, "Maximum 100 enum values allowed"),
  defaultValue: z.string().optional(),
}).refine(
  (data) => {
    if (data.defaultValue) {
      return data.enumValues.includes(data.defaultValue);
    }
    return true;
  },
  { message: "defaultValue must be one of enumValues" }
);

// DateTime field with optional date range constraints
export const DateTimeFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("datetime"),
  minDate: z.string().datetime().optional(),
  maxDate: z.string().datetime().optional(),
  defaultValue: z.union([z.string().datetime(), z.literal("now")]).optional(),
}).refine(
  (data) => {
    if (data.minDate && data.maxDate) {
      return new Date(data.maxDate) >= new Date(data.minDate);
    }
    return true;
  },
  { message: "maxDate must be >= minDate" }
);

// JSON field for flexible structured data
export const JsonFieldConfigSchema = BaseFieldConfigSchema.extend({
  dataType: z.literal("json"),
  defaultValue: z.record(z.string(), z.any()).optional(),
});

// Discriminated union of all field types
export const FieldConfigSchema = z.discriminatedUnion("dataType", [
  TextFieldConfigSchema,
  IntegerFieldConfigSchema,
  NumericFieldConfigSchema,
  BooleanFieldConfigSchema,
  EnumFieldConfigSchema,
  DateTimeFieldConfigSchema,
  JsonFieldConfigSchema,
]);

// ========================================
// Table Configuration Schema
// ========================================

export const TableConstraintsSchema = z
  .object({
    unique: z.array(z.array(z.string())).optional(),
    check: z.array(z.string()).optional(),
  })
  .optional();

export const TableConfigSchema = z
  .object({
    tableName: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*$/, "Table name must be snake_case")
      .min(1)
      .max(63),
    toolId: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, "Tool ID must be kebab-case")
      .min(1)
      .max(50),
    displayName: z.string().min(1).max(100),
    description: z.string().min(10).max(500),
    fields: z.array(FieldConfigSchema).min(1, "At least one field required"),
    columnMappings: z.record(z.string(), z.string()).optional(),
    constraints: TableConstraintsSchema,
  })
  .refine(
    (data) => {
      const fieldNames = new Set(data.fields.map((f) => f.name));
      return fieldNames.size === data.fields.length;
    },
    { message: "Field names must be unique within table" }
  );

// ========================================
// Root Configuration Schema
// ========================================

export const ConfigMetadataSchema = z
  .object({
    author: z.string().optional(),
    description: z.string().optional(),
    createdAt: z.string().datetime().optional(),
    updatedAt: z.string().datetime().optional(),
  })
  .optional();

export const ToolConfigurationSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver format"),
    tables: z
      .array(TableConfigSchema)
      .min(1, "At least one table required")
      .max(100, "Maximum 100 tables allowed"),
    metadata: ConfigMetadataSchema,
  })
  .refine(
    (data) => {
      const toolIds = new Set(data.tables.map((t) => t.toolId));
      return toolIds.size === data.tables.length;
    },
    { message: "Tool IDs must be unique across all tables" }
  );

// ========================================
// TypeScript Types (exported from schemas)
// ========================================

export type TextFieldConfig = z.infer<typeof TextFieldConfigSchema>;
export type IntegerFieldConfig = z.infer<typeof IntegerFieldConfigSchema>;
export type NumericFieldConfig = z.infer<typeof NumericFieldConfigSchema>;
export type BooleanFieldConfig = z.infer<typeof BooleanFieldConfigSchema>;
export type EnumFieldConfig = z.infer<typeof EnumFieldConfigSchema>;
export type DateTimeFieldConfig = z.infer<typeof DateTimeFieldConfigSchema>;
export type JsonFieldConfig = z.infer<typeof JsonFieldConfigSchema>;
export type FieldConfig = z.infer<typeof FieldConfigSchema>;

export type TableConstraints = z.infer<typeof TableConstraintsSchema>;
export type TableConfig = z.infer<typeof TableConfigSchema>;

export type ConfigMetadata = z.infer<typeof ConfigMetadataSchema>;
export type ToolConfiguration = z.infer<typeof ToolConfigurationSchema>;
