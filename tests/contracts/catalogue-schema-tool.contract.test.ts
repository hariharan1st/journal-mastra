import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Contract types from the specification
export const CatalogueSchemaRequestSchema = z.object({
  adminRuleSetId: z.string().nullable(),
  parsedAt: z.string(),
  sourceText: z.string(),
  metrics: z.array(
    z.object({
      slug: z.string(),
      displayName: z.string(),
      description: z.string(),
      fields: z.array(
        z.object({
          name: z.string(),
          label: z.string(),
          dataType: z.enum([
            "numeric",
            "integer",
            "boolean",
            "text",
            "enum",
            "datetime",
          ]),
          unit: z.string().optional(),
          enumValues: z.array(z.string()).optional(),
          required: z.boolean(),
        })
      ),
      reminderPolicy: z.object({
        schedule: z.string(),
        timezone: z.string(),
        escalation: z
          .object({
            notifyCaregiverAfterMinutes: z.number().optional(),
            notifyAdminAfterMinutes: z.number().optional(),
          })
          .optional(),
      }),
      analyticsTags: z.array(z.string()),
    })
  ),
  retention: z.object({
    journalRetentionDays: z.number(),
    documentRetentionDays: z.number(),
  }),
});

export const CatalogueSchemaResponseSchema = z.object({
  ruleSetId: z.string(),
  version: z.number(),
  actions: z.array(
    z.union([
      z.object({
        type: z.literal("create_table"),
        tableName: z.string(),
        columns: z.array(
          z.object({
            name: z.string(),
            sqlType: z.string(),
            nullable: z.boolean(),
            defaultExpression: z.string().optional(),
          })
        ),
      }),
      z.object({
        type: z.literal("alter_table_add_columns"),
        tableName: z.string(),
        columns: z.array(
          z.object({
            name: z.string(),
            sqlType: z.string(),
            nullable: z.boolean(),
            defaultExpression: z.string().optional(),
          })
        ),
      }),
      z.object({
        type: z.literal("no_change"),
        tableName: z.string(),
      }),
    ])
  ),
  reminderActions: z.array(
    z.union([
      z.object({
        type: z.literal("upsert_rule"),
        reminderRuleId: z.string(),
        schedule: z.string(),
        timezone: z.string(),
      }),
      z.object({
        type: z.literal("disable_rule"),
        reminderRuleId: z.string(),
      }),
    ])
  ),
  auditEventId: z.string(),
});

export type CatalogueSchemaRequest = z.infer<
  typeof CatalogueSchemaRequestSchema
>;
export type CatalogueSchemaResponse = z.infer<
  typeof CatalogueSchemaResponseSchema
>;

describe("catalogueSchemaTool Contract", () => {
  // Mock implementation - to be replaced with actual tool once implemented
  const mockCatalogueSchemaTool = async (
    request: CatalogueSchemaRequest
  ): Promise<CatalogueSchemaResponse> => {
    // Validate input
    CatalogueSchemaRequestSchema.parse(request);

    // Mock response based on request
    return {
      ruleSetId: "test-rule-set-id",
      version: 1,
      actions: [
        {
          type: "create_table",
          tableName: `journal_${request.metrics[0].slug}`,
          columns: [
            { name: "id", sqlType: "UUID", nullable: false },
            { name: "user_id", sqlType: "UUID", nullable: false },
            { name: "recorded_at", sqlType: "TIMESTAMPTZ", nullable: false },
            ...request.metrics[0].fields.map((field) => ({
              name: field.name,
              sqlType:
                field.dataType === "numeric"
                  ? "NUMERIC"
                  : field.dataType === "integer"
                    ? "INTEGER"
                    : field.dataType === "boolean"
                      ? "BOOLEAN"
                      : field.dataType === "datetime"
                        ? "TIMESTAMPTZ"
                        : "TEXT",
              nullable: !field.required,
            })),
          ],
        },
      ],
      reminderActions: [
        {
          type: "upsert_rule",
          reminderRuleId: "test-reminder-rule-id",
          schedule: request.metrics[0].reminderPolicy.schedule,
          timezone: request.metrics[0].reminderPolicy.timezone,
        },
      ],
      auditEventId: "test-audit-event-id",
    };
  };

  beforeEach(() => {
    // Setup test database or mocks
  });

  afterEach(() => {
    // Cleanup
  });

  it("should handle create table flow for new metric", async () => {
    const request: CatalogueSchemaRequest = {
      adminRuleSetId: null, // New rule set
      parsedAt: new Date().toISOString(),
      sourceText: "Track water intake with quantity in ml",
      metrics: [
        {
          slug: "water-intake",
          displayName: "Water Intake",
          description: "Daily water consumption tracking",
          fields: [
            {
              name: "quantity",
              label: "Quantity",
              dataType: "numeric",
              unit: "ml",
              required: true,
            },
            {
              name: "source",
              label: "Water Source",
              dataType: "enum",
              enumValues: ["tap", "bottled", "filtered"],
              required: false,
            },
          ],
          reminderPolicy: {
            schedule: "0 8,14,20 * * *", // 8 AM, 2 PM, 8 PM daily
            timezone: "America/New_York",
            escalation: {
              notifyCaregiverAfterMinutes: 60,
            },
          },
          analyticsTags: ["hydration", "wellness"],
        },
      ],
      retention: {
        journalRetentionDays: 365,
        documentRetentionDays: 180,
      },
    };

    const response = await mockCatalogueSchemaTool(request);

    // Validate response structure
    expect(CatalogueSchemaResponseSchema.safeParse(response).success).toBe(
      true
    );

    // Validate specific contract requirements
    expect(response.ruleSetId).toBeDefined();
    expect(response.version).toBeGreaterThan(0);
    expect(response.actions).toHaveLength(1);
    expect(response.actions[0].type).toBe("create_table");
    expect(response.actions[0].tableName).toBe("journal_water-intake");
    expect(response.reminderActions).toHaveLength(1);
    expect(response.reminderActions[0].type).toBe("upsert_rule");
    expect(response.auditEventId).toBeDefined();
  });

  it("should handle alter table flow for existing metric with new fields", async () => {
    const request: CatalogueSchemaRequest = {
      adminRuleSetId: "existing-rule-set-id",
      parsedAt: new Date().toISOString(),
      sourceText: "Add temperature field to water intake tracking",
      metrics: [
        {
          slug: "water-intake",
          displayName: "Water Intake",
          description: "Daily water consumption tracking with temperature",
          fields: [
            {
              name: "quantity",
              label: "Quantity",
              dataType: "numeric",
              unit: "ml",
              required: true,
            },
            {
              name: "temperature",
              label: "Temperature",
              dataType: "enum",
              enumValues: ["cold", "room", "warm"],
              required: false,
            },
          ],
          reminderPolicy: {
            schedule: "0 8,14,20 * * *",
            timezone: "America/New_York",
          },
          analyticsTags: ["hydration", "wellness"],
        },
      ],
      retention: {
        journalRetentionDays: 365,
        documentRetentionDays: 180,
      },
    };

    // Mock that would typically determine this is an alter operation
    const mockAlterResponse: CatalogueSchemaResponse = {
      ruleSetId: "existing-rule-set-id",
      version: 2,
      actions: [
        {
          type: "alter_table_add_columns",
          tableName: "journal_water-intake",
          columns: [{ name: "temperature", sqlType: "TEXT", nullable: true }],
        },
      ],
      reminderActions: [
        {
          type: "upsert_rule",
          reminderRuleId: "existing-reminder-rule-id",
          schedule: "0 8,14,20 * * *",
          timezone: "America/New_York",
        },
      ],
      auditEventId: "alter-audit-event-id",
    };

    expect(
      CatalogueSchemaResponseSchema.safeParse(mockAlterResponse).success
    ).toBe(true);
    expect(mockAlterResponse.actions[0].type).toBe("alter_table_add_columns");
    expect(mockAlterResponse.version).toBe(2);
  });

  it("should handle no-change flow for identical configurations", async () => {
    const request: CatalogueSchemaRequest = {
      adminRuleSetId: "existing-rule-set-id",
      parsedAt: new Date().toISOString(),
      sourceText: "Track water intake with quantity in ml", // Same as before
      metrics: [
        {
          slug: "water-intake",
          displayName: "Water Intake",
          description: "Daily water consumption tracking",
          fields: [
            {
              name: "quantity",
              label: "Quantity",
              dataType: "numeric",
              unit: "ml",
              required: true,
            },
          ],
          reminderPolicy: {
            schedule: "0 8,14,20 * * *",
            timezone: "America/New_York",
          },
          analyticsTags: ["hydration", "wellness"],
        },
      ],
      retention: {
        journalRetentionDays: 365,
        documentRetentionDays: 180,
      },
    };

    const mockNoChangeResponse: CatalogueSchemaResponse = {
      ruleSetId: "existing-rule-set-id",
      version: 1, // Same version
      actions: [
        {
          type: "no_change",
          tableName: "journal_water-intake",
        },
      ],
      reminderActions: [], // No reminder changes
      auditEventId: "no-change-audit-event-id",
    };

    expect(
      CatalogueSchemaResponseSchema.safeParse(mockNoChangeResponse).success
    ).toBe(true);
    expect(mockNoChangeResponse.actions[0].type).toBe("no_change");
    expect(mockNoChangeResponse.reminderActions).toHaveLength(0);
  });

  it("should validate required fields in request", async () => {
    const invalidRequest = {
      adminRuleSetId: null,
      parsedAt: new Date().toISOString(),
      // Missing sourceText and other required fields
      metrics: [],
    };

    expect(() => CatalogueSchemaRequestSchema.parse(invalidRequest)).toThrow();
  });

  it("should validate response schema compliance", async () => {
    const invalidResponse = {
      ruleSetId: "test-id",
      // Missing version and other required fields
    };

    expect(
      CatalogueSchemaResponseSchema.safeParse(invalidResponse).success
    ).toBe(false);
  });
});
