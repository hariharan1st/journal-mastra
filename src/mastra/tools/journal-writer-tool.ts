import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import { getPrismaClient } from "../lib/prisma-client.js";
import { PrismaClient, Prisma } from "@prisma/client";

// Request schema matching the contract
export const JournalWriterRequestSchema = z.object({
  userId: z.string(),
  telegramMessageId: z.string(),
  receivedAt: z.string(), // ISO timestamp from Telegram
  catalogueItemSlug: z.string(), // maps to tracking_catalogue_items.slug
  healthWeekLabel: z.enum(["healthy", "unhealthy"]).optional(),
  parsedFields: z.array(
    z.object({
      name: z.string(), // column name
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      confidence: z.number().min(0).max(1), // 0-1
      unit: z.string().optional(),
    })
  ),
  freeformNotes: z.string().optional(),
});

// Response schema matching the contract
export const JournalWriterResponseSchema = z.object({
  journalTable: z.string(),
  insertedRecordId: z.string(),
  normalizedFields: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    })
  ),
  promptsIssued: z.array(
    z.object({
      type: z.enum(["missing_field", "low_confidence", "follow_up"]),
      message: z.string(),
    })
  ),
  auditEventId: z.string(),
});

// Error schema matching the contract
export const JournalWriterErrorSchema = z.object({
  code: z.enum([
    "UNKNOWN_CATALOGUE_ITEM",
    "VALIDATION_FAILED",
    "DB_WRITE_ERROR",
    "CONSENT_REVOKED",
    "RLS_DENIED",
  ]),
  message: z.string(),
  remediation: z.string().optional(),
});

export type JournalWriterRequest = z.infer<typeof JournalWriterRequestSchema>;
export type JournalWriterResponse = z.infer<typeof JournalWriterResponseSchema>;
export type JournalWriterError = z.infer<typeof JournalWriterErrorSchema>;

interface JournalWriterContext {
  prisma: PrismaClient;
  userId: string;
  catalogueItemSlug: string;
  telegramMessageId: string;
  receivedAt: Date;
  healthWeekLabel?: "healthy" | "unhealthy";
  parsedFields: JournalWriterRequest["parsedFields"];
  freeformNotes?: string;
}

/**
 * Journal Writer Tool - Persists user journal entries into dynamic tables
 *
 * This tool handles the persistence of parsed user messages into the appropriate
 * dynamic journal tables, with proper validation, consent checking, and audit logging.
 */
export class JournalWriterTool {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || getPrismaClient();
  }

  /**
   * Execute the journal writer tool
   */
  async execute(request: JournalWriterRequest): Promise<JournalWriterResponse> {
    // Validate request schema
    const validatedRequest = JournalWriterRequestSchema.parse(request);

    const context: JournalWriterContext = {
      prisma: this.prisma,
      userId: validatedRequest.userId,
      catalogueItemSlug: validatedRequest.catalogueItemSlug,
      telegramMessageId: validatedRequest.telegramMessageId,
      receivedAt: new Date(validatedRequest.receivedAt),
      healthWeekLabel: validatedRequest.healthWeekLabel,
      parsedFields: validatedRequest.parsedFields,
      freeformNotes: validatedRequest.freeformNotes,
    };

    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Step 1: Check user consent
          await this.checkUserConsent(tx, context.userId);

          // Step 2: Resolve catalogue item and journal table
          const { catalogueItem, journalTable } =
            await this.resolveCatalogueItem(tx, context.catalogueItemSlug);

          // Step 3: Validate and normalize fields
          const { normalizedFields, promptsIssued } =
            await this.validateAndNormalizeFields(
              tx,
              catalogueItem.id,
              context.parsedFields
            );

          // Step 4: Insert journal entry
          const insertedRecordId = await this.insertJournalEntry(
            tx,
            journalTable.table_name,
            context,
            normalizedFields
          );

          // Step 5: Create audit event
          const auditEventId = await this.createAuditEvent(
            tx,
            context,
            journalTable.table_name,
            insertedRecordId,
            normalizedFields
          );

          return {
            journalTable: journalTable.table_name,
            insertedRecordId,
            normalizedFields: normalizedFields.map(({ name, value }) => ({
              name,
              value,
            })),
            promptsIssued,
            auditEventId,
          };
        }
      );
    } catch (error) {
      if (error instanceof JournalWriterToolError) {
        throw error;
      }
      throw new JournalWriterToolError(
        "DB_WRITE_ERROR",
        `Database operation failed: ${error}`
      );
    }
  }

  /**
   * Check if user has granted consent for journal writing
   */
  private async checkUserConsent(
    tx: Prisma.TransactionClient,
    userId: string
  ): Promise<void> {
    const userProfile = await tx.user_profiles.findUnique({
      where: { id: userId },
      select: { consent_status: true },
    });

    if (!userProfile) {
      throw new JournalWriterToolError(
        "RLS_DENIED",
        "User profile not found",
        "Ensure user is properly registered"
      );
    }

    if (userProfile.consent_status !== "granted") {
      throw new JournalWriterToolError(
        "CONSENT_REVOKED",
        "User has not granted consent for data collection",
        "Request user consent before attempting to record journal entries"
      );
    }
  }

  /**
   * Resolve catalogue item and associated journal table
   */
  private async resolveCatalogueItem(
    tx: Prisma.TransactionClient,
    catalogueItemSlug: string
  ): Promise<{
    catalogueItem: { id: string; slug: string; display_name: string };
    journalTable: { table_name: string; schema_version: number };
  }> {
    const catalogueItem = await tx.tracking_catalogue_items.findFirst({
      where: {
        slug: catalogueItemSlug,
        // Only consider items from published rule sets
        rule_set: {
          status: "published",
        },
      },
      select: { id: true, slug: true, display_name: true },
    });

    if (!catalogueItem) {
      throw new JournalWriterToolError(
        "UNKNOWN_CATALOGUE_ITEM",
        `Catalogue item with slug '${catalogueItemSlug}' not found`,
        "Ensure the catalogue item exists and is published"
      );
    }

    const journalTable = await tx.journal_entry_tables.findUnique({
      where: { catalogue_item_id: catalogueItem.id },
      select: { table_name: true, schema_version: true },
    });

    if (!journalTable) {
      throw new JournalWriterToolError(
        "DB_WRITE_ERROR",
        `Journal table not found for catalogue item '${catalogueItemSlug}'`,
        "The catalogue item may not have been properly provisioned"
      );
    }

    return { catalogueItem, journalTable };
  }

  /**
   * Validate fields against catalogue schema and normalize values
   */
  private async validateAndNormalizeFields(
    tx: Prisma.TransactionClient,
    catalogueItemId: string,
    parsedFields: JournalWriterRequest["parsedFields"]
  ): Promise<{
    normalizedFields: Array<{ name: string; value: any; sqlType: string }>;
    promptsIssued: Array<{
      type: "missing_field" | "low_confidence" | "follow_up";
      message: string;
    }>;
  }> {
    // Get field definitions from catalogue
    const catalogueFields = await tx.tracking_catalogue_fields.findMany({
      where: { catalogue_item_id: catalogueItemId },
      select: {
        column_name: true,
        label: true,
        data_type: true,
        required: true,
        enum_values: true,
        unit_hints: true,
      },
    });

    const normalizedFields: Array<{
      name: string;
      value: any;
      sqlType: string;
    }> = [];
    const promptsIssued: Array<{
      type: "missing_field" | "low_confidence" | "follow_up";
      message: string;
    }> = [];

    // Check for missing required fields
    const providedFieldNames = new Set(parsedFields.map((f) => f.name));
    for (const catalogueField of catalogueFields) {
      if (
        catalogueField.required &&
        !providedFieldNames.has(catalogueField.column_name)
      ) {
        promptsIssued.push({
          type: "missing_field",
          message: `Required field '${catalogueField.label}' is missing. Please provide a value for ${catalogueField.label}.`,
        });
      }
    }

    // Process provided fields
    for (const parsedField of parsedFields) {
      const catalogueField = catalogueFields.find(
        (cf: any) => cf.column_name === parsedField.name
      );

      if (!catalogueField) {
        // Field not in catalogue - skip it
        continue;
      }

      // Check confidence level
      if (parsedField.confidence < 0.7) {
        promptsIssued.push({
          type: "low_confidence",
          message: `I'm not confident about the value for '${catalogueField.label}'. Did you mean ${parsedField.value}?`,
        });
      }

      // Normalize value based on data type
      const { normalizedValue, sqlType } = this.normalizeFieldValue(
        parsedField.value,
        catalogueField.data_type,
        catalogueField.enum_values
      );

      normalizedFields.push({
        name: parsedField.name,
        value: normalizedValue,
        sqlType,
      });

      // Check units if provided
      if (
        parsedField.unit &&
        catalogueField.unit_hints &&
        catalogueField.unit_hints.length > 0
      ) {
        if (!catalogueField.unit_hints.includes(parsedField.unit)) {
          promptsIssued.push({
            type: "follow_up",
            message: `Unit '${parsedField.unit}' for ${catalogueField.label} seems unusual. Expected units: ${catalogueField.unit_hints.join(", ")}.`,
          });
        }
      }
    }

    return { normalizedFields, promptsIssued };
  }

  /**
   * Normalize field value based on data type
   */
  private normalizeFieldValue(
    value: string | number | boolean | null,
    dataType: string,
    enumValues?: string[] | null
  ): { normalizedValue: any; sqlType: string } {
    if (value === null) {
      return { normalizedValue: null, sqlType: this.getSqlType(dataType) };
    }

    switch (dataType) {
      case "int":
      case "integer":
        const intValue =
          typeof value === "number" ? value : parseInt(String(value), 10);
        if (isNaN(intValue)) {
          throw new JournalWriterToolError(
            "VALIDATION_FAILED",
            `Invalid integer value: ${value}`
          );
        }
        return { normalizedValue: intValue, sqlType: "INTEGER" };

      case "numeric":
        const numValue =
          typeof value === "number" ? value : parseFloat(String(value));
        if (isNaN(numValue)) {
          throw new JournalWriterToolError(
            "VALIDATION_FAILED",
            `Invalid numeric value: ${value}`
          );
        }
        return { normalizedValue: numValue, sqlType: "NUMERIC" };

      case "boolean":
        const boolValue =
          typeof value === "boolean"
            ? value
            : String(value).toLowerCase() === "true" || String(value) === "1";
        return { normalizedValue: boolValue, sqlType: "BOOLEAN" };

      case "enum":
        const strValue = String(value);
        if (enumValues && !enumValues.includes(strValue)) {
          throw new JournalWriterToolError(
            "VALIDATION_FAILED",
            `Invalid enum value: ${strValue}. Expected one of: ${enumValues.join(", ")}`
          );
        }
        return { normalizedValue: strValue, sqlType: "TEXT" };

      case "timestamp":
        const dateValue = new Date(String(value));
        if (isNaN(dateValue.getTime())) {
          throw new JournalWriterToolError(
            "VALIDATION_FAILED",
            `Invalid timestamp value: ${value}`
          );
        }
        return { normalizedValue: dateValue, sqlType: "TIMESTAMPTZ" };

      case "text":
      default:
        return { normalizedValue: String(value), sqlType: "TEXT" };
    }
  }

  /**
   * Get SQL type for Prisma data type
   */
  private getSqlType(dataType: string): string {
    switch (dataType) {
      case "int":
      case "integer":
        return "INTEGER";
      case "numeric":
        return "NUMERIC";
      case "boolean":
        return "BOOLEAN";
      case "timestamp":
        return "TIMESTAMPTZ";
      case "text":
      case "enum":
      default:
        return "TEXT";
    }
  }

  /**
   * Insert journal entry into dynamic table
   */
  private async insertJournalEntry(
    tx: Prisma.TransactionClient,
    tableName: string,
    context: JournalWriterContext,
    normalizedFields: Array<{ name: string; value: any; sqlType: string }>
  ): Promise<string> {
    // Build base fields that exist on all dynamic tables
    const baseFields = {
      id: crypto.randomUUID(),
      user_id: context.userId,
      who_recorded: null, // User self-recording
      source_message_id: context.telegramMessageId,
      submitted_at: context.receivedAt,
      recorded_at: new Date(),
      health_week_label: context.healthWeekLabel || "unspecified",
      meta: JSON.stringify({
        parsedFields: context.parsedFields,
        freeformNotes: context.freeformNotes,
      }),
    };

    // Build dynamic fields
    const dynamicFields: Record<string, any> = {};
    for (const field of normalizedFields) {
      dynamicFields[field.name] = field.value;
    }

    // Combine all fields
    const allFields = { ...baseFields, ...dynamicFields };

    // Build column names and values for parameterized query
    const columnNames = Object.keys(allFields);
    const placeholders = columnNames
      .map((_, index) => `$${index + 1}`)
      .join(", ");
    const values = Object.values(allFields);

    // Execute insert with parameterized query to prevent SQL injection
    const insertQuery = `
      INSERT INTO "${tableName}" (${columnNames.map((name) => `"${name}"`).join(", ")})
      VALUES (${placeholders})
      RETURNING id
    `;

    const result = await tx.$queryRawUnsafe(insertQuery, ...values);
    const resultArray = result as any[];

    if (!resultArray || resultArray.length === 0) {
      throw new JournalWriterToolError(
        "DB_WRITE_ERROR",
        "Failed to insert journal entry"
      );
    }

    return resultArray[0].id;
  }

  /**
   * Create audit event for journal entry
   */
  private async createAuditEvent(
    tx: Prisma.TransactionClient,
    context: JournalWriterContext,
    tableName: string,
    recordId: string,
    normalizedFields: Array<{ name: string; value: any; sqlType: string }>
  ): Promise<string> {
    const auditEvent = await tx.audit_events.create({
      data: {
        actor_type: "user",
        actor_id: context.userId,
        event_type: "journal.inserted",
        resource_ref: `${tableName}:${recordId}`,
        payload: {
          tableName,
          recordId,
          telegramMessageId: context.telegramMessageId,
          catalogueItemSlug: context.catalogueItemSlug,
          healthWeekLabel: context.healthWeekLabel,
          normalizedFields: normalizedFields.map(({ name, value }) => ({
            name,
            value,
          })),
          originalParsedFields: context.parsedFields,
          freeformNotes: context.freeformNotes,
        },
      },
    });

    return auditEvent.id;
  }
}

/**
 * Custom error class for journal writer tool
 */
export class JournalWriterToolError extends Error {
  constructor(
    public code: JournalWriterError["code"],
    message: string,
    public remediation?: string
  ) {
    super(message);
    this.name = "JournalWriterToolError";
  }

  toErrorResponse(): JournalWriterError {
    return {
      code: this.code,
      message: this.message,
      remediation: this.remediation,
    };
  }
}

/**
 * Factory function to create a configured journal writer tool
 */
export function createJournalWriterTool(
  prisma?: PrismaClient
): JournalWriterTool {
  return new JournalWriterTool(prisma);
}

/**
 * Execute journal writer tool with request validation
 */
export async function executeJournalWriterTool(
  request: unknown,
  prisma?: PrismaClient
): Promise<JournalWriterResponse> {
  const tool = createJournalWriterTool(prisma);

  try {
    return await tool.execute(request as JournalWriterRequest);
  } catch (error) {
    if (error instanceof JournalWriterToolError) {
      throw error;
    }
    throw new JournalWriterToolError(
      "DB_WRITE_ERROR",
      `Unexpected error: ${error}`
    );
  }
}

// Mastra tool wrapper
export const journalWriterTool = createTool({
  id: "journal-writer",
  description: "Process and persist journal entries with follow-up prompts",
  inputSchema: JournalWriterRequestSchema,
  outputSchema: JournalWriterResponseSchema,
  execute: async ({ context }) => {
    return await executeJournalWriterTool(context);
  },
});
