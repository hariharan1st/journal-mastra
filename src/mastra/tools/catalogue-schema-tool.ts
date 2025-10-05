import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import {
  buildCatalogueSchemaRequest,
  defaultCatalogueSchemaParser,
  AdminTextInputSchema,
  MetricDefinitionSchema,
} from "../lib/parsing/catalogue-schema-parser.js";
import {
  DynamicTableManager,
  TableAction,
  ColumnSpec,
} from "../services/dynamic-table-manager.js";
import {
  ReminderRuleService,
  ReminderSyncAction,
  ReminderPolicySchema,
} from "../services/reminder-rule-service.js";
import { getPrismaClient } from "../lib/prisma-client.js";
import { PrismaClient, Prisma } from "@prisma/client";

// Request schema matching the contract
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

// Response schema matching the contract
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

/**
 * Tool for processing admin catalogue configuration and executing schema updates
 * Wires together the parser, dynamic table manager, and reminder service
 */
export class CatalogueSchemaTool {
  private prisma: PrismaClient;
  private tableManager: DynamicTableManager;
  private reminderService: ReminderRuleService;

  constructor(
    prismaClient?: PrismaClient,
    tableManager?: DynamicTableManager,
    reminderService?: ReminderRuleService
  ) {
    this.prisma = prismaClient || getPrismaClient();
    this.tableManager = tableManager || new DynamicTableManager(this.prisma);
    this.reminderService =
      reminderService || new ReminderRuleService(this.prisma);
  }

  /**
   * Process catalogue schema update request
   * Creates/updates admin rule set, manages dynamic tables, and syncs reminder rules
   */
  async processSchemaUpdate(
    request: CatalogueSchemaRequest,
    actorId: string
  ): Promise<CatalogueSchemaResponse> {
    try {
      // Validate request
      const validatedRequest = CatalogueSchemaRequestSchema.parse(request);

      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          // Create or update admin rule set
          const ruleSet = await this.createOrUpdateRuleSet(
            tx,
            validatedRequest,
            actorId
          );

          // Process each metric to create/update catalogue items and tables
          const tableActions: TableAction[] = [];
          const reminderSyncResults: ReminderSyncAction[] = [];
          const catalogueItemIds: string[] = [];

          for (const metric of validatedRequest.metrics) {
            // Create or update catalogue item
            const catalogueItem = await this.upsertCatalogueItem(
              tx,
              ruleSet.id,
              metric
            );
            catalogueItemIds.push(catalogueItem.id);

            // Update catalogue fields
            await this.upsertCatalogueFields(
              tx,
              catalogueItem.id,
              metric.fields
            );

            // Plan and execute table operations
            const tableAction = await this.tableManager.planTableChanges(
              catalogueItem.id,
              metric.fields.map((field) => ({
                name: field.name,
                dataType: field.dataType,
                required: field.required,
                enumValues: field.enumValues,
                unit: field.unit,
              })),
              metric.slug
            );

            if (tableAction.type !== "no_change") {
              await this.tableManager.executeTableAction(
                tableAction,
                ruleSet.id
              );
            }

            tableActions.push(tableAction);

            // Sync reminder rules
            const reminderResult = await this.reminderService.syncReminderRules(
              catalogueItem.id,
              {
                schedule: metric.reminderPolicy.schedule,
                timezone: metric.reminderPolicy.timezone,
                escalation: metric.reminderPolicy.escalation,
              },
              actorId
            );

            reminderSyncResults.push(...reminderResult.actions);
          }

          // Create audit event for the overall operation
          const auditEvent = await tx.auditEvent.create({
            data: {
              actorType: "admin",
              actorId,
              eventType: "catalogue.schema_update",
              resourceRef: `admin_rule_set:${ruleSet.id}`,
              payload: {
                ruleSetId: ruleSet.id,
                version: ruleSet.version,
                metricsCount: validatedRequest.metrics.length,
                tableActions: tableActions.map((action) => ({
                  type: action.type,
                  tableName: action.tableName,
                })),
                reminderActions: reminderSyncResults.map((action) => ({
                  type: action.type,
                  reminderRuleId: action.reminderRuleId,
                })),
              },
            },
          });

          // Build response
          return {
            ruleSetId: ruleSet.id,
            version: ruleSet.version,
            actions: tableActions.map((action) => ({
              type: action.type,
              tableName: action.tableName,
              columns: action.type !== "no_change" ? action.columns : undefined,
            })) as any, // Type assertion needed due to union complexity
            reminderActions: reminderSyncResults
              .filter((action) => action.type !== "no_change")
              .map((action) => ({
                type: action.type,
                reminderRuleId: action.reminderRuleId,
                schedule:
                  action.type === "upsert_rule" ? action.schedule : undefined,
                timezone:
                  action.type === "upsert_rule" ? action.timezone : undefined,
              })) as any, // Type assertion needed due to union complexity
            auditEventId: auditEvent.id,
          };
        }
      );
    } catch (error) {
      // Handle and rethrow errors
      console.error("Error processing catalogue schema update:", error);
      throw error;
    }
  }

  /**
   * Create new admin rule set or update existing one
   */
  private async createOrUpdateRuleSet(
    tx: Prisma.TransactionClient,
    request: CatalogueSchemaRequest,
    actorId: string
  ) {
    // Mark existing rule sets as superseded
    await tx.adminRuleSet.updateMany({
      where: { status: "published" },
      data: { status: "superseded" },
    });

    // Calculate version number
    const lastVersion = await tx.adminRuleSet.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    // Create checksum for deduplication
    const checksum = this.calculateChecksum(request);

    // Create new rule set (let Prisma auto-generate the UUID)
    return await tx.adminRuleSet.create({
      data: {
        version: nextVersion,
        publishedAt: new Date(request.parsedAt),
        publishedBy: actorId,
        sourceText: request.sourceText,
        structuredConfig: {
          metrics: request.metrics,
          retention: request.retention,
        },
        status: "published",
        checksum,
      },
    });
  }

  /**
   * Create or update catalogue item
   */
  private async upsertCatalogueItem(
    tx: Prisma.TransactionClient,
    ruleSetId: string,
    metric: any
  ) {
    return await tx.trackingCatalogueItem.upsert({
      where: {
        ruleSetId_slug: {
          ruleSetId,
          slug: metric.slug,
        },
      },
      update: {
        displayName: metric.displayName,
        description: metric.description,
        analyticsTags: metric.analyticsTags,
        // Note: frequency would be derived from reminderPolicy if needed
        frequency: "daily", // Default for now
        reminderTemplate: {
          schedule: metric.reminderPolicy.schedule,
          timezone: metric.reminderPolicy.timezone,
        },
      },
      create: {
        ruleSetId,
        slug: metric.slug,
        displayName: metric.displayName,
        description: metric.description,
        frequency: "daily", // Default
        reminderTemplate: {
          schedule: metric.reminderPolicy.schedule,
          timezone: metric.reminderPolicy.timezone,
        },
        analyticsTags: metric.analyticsTags,
      },
    });
  }

  /**
   * Create or update catalogue fields
   */
  private async upsertCatalogueFields(
    tx: Prisma.TransactionClient,
    catalogueItemId: string,
    fields: any[]
  ) {
    // Delete removed fields (we'll implement this as a soft update for now)
    // In a production system, you might want to mark fields as inactive instead

    for (const field of fields) {
      await tx.trackingCatalogueField.upsert({
        where: {
          catalogueItemId_columnName: {
            catalogueItemId,
            columnName: field.name,
          },
        },
        update: {
          label: field.label,
          dataType: field.dataType,
          unitHints: field.unit ? [field.unit] : [],
          required: field.required,
          enumValues: field.enumValues || [],
          example: field.example,
        },
        create: {
          catalogueItemId,
          columnName: field.name,
          label: field.label,
          dataType: field.dataType,
          unitHints: field.unit ? [field.unit] : [],
          required: field.required,
          enumValues: field.enumValues || [],
          example: field.example,
        },
      });
    }
  }

  /**
   * Calculate checksum for deduplication
   */
  private calculateChecksum(request: CatalogueSchemaRequest): string {
    const normalizedRequest = {
      metrics: request.metrics.sort((a, b) => a.slug.localeCompare(b.slug)),
      retention: request.retention,
    };

    return Buffer.from(JSON.stringify(normalizedRequest))
      .toString("base64")
      .slice(0, 32);
  }

  /**
   * Validate admin text input using the parser
   * Returns parsed metrics and validation errors
   */
  async validateAdminText(sourceText: string): Promise<{
    isValid: boolean;
    metrics?: any[];
    errors: string[];
  }> {
    try {
      const parsedCatalogue = defaultCatalogueSchemaParser.parse({
        sourceText,
        ruleSetId: null,
      });

      return {
        isValid: true,
        metrics: parsedCatalogue.metrics,
        errors: [],
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          `Parse error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      };
    }
  }
}

// Export singleton instance
export const catalogueSchemaToolImpl = new CatalogueSchemaTool();

// Mastra tool wrapper
export const catalogueSchemaTool = createTool({
  id: "catalogue-schema",
  description:
    "Parse admin text into catalogue schema updates and execute database changes",
  inputSchema: CatalogueSchemaRequestSchema,
  outputSchema: CatalogueSchemaResponseSchema,
  execute: async ({ context }) => {
    return await catalogueSchemaToolImpl.processSchemaUpdate(
      context,
      "admin-agent" // Default actor ID for admin agent usage
    );
  },
});
