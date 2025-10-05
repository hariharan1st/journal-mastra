import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { catalogueSchemaToolImpl } from "../tools/catalogue-schema-tool";
import { getPrismaClient } from "../lib/prisma-client";

// Input schema for the catalogue sync workflow
const CatalogueSyncInputSchema = z.object({
  adminRuleSetId: z.string().nullable(),
  sourceText: z.string(),
  actorId: z.string(),
  parsedAt: z.string().optional(),
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

type CatalogueSyncInput = z.infer<typeof CatalogueSyncInputSchema>;

// Step 1: Validate input and prepare request
const validateInputStep = createStep({
  id: "validate-input",
  description: "Validate input and prepare catalogue schema request",
  inputSchema: CatalogueSyncInputSchema,
  outputSchema: z.object({
    validatedInput: CatalogueSyncInputSchema,
    catalogueRequest: z.any(),
    actorId: z.string(),
  }),
  execute: async ({ inputData }) => {
    const validatedInput = CatalogueSyncInputSchema.parse(inputData);

    // Prepare the request for the catalogue schema tool
    const request = {
      adminRuleSetId: validatedInput.adminRuleSetId,
      parsedAt: validatedInput.parsedAt || new Date().toISOString(),
      sourceText: validatedInput.sourceText,
      metrics: validatedInput.metrics,
      retention: validatedInput.retention,
    };

    return {
      validatedInput,
      catalogueRequest: request,
      actorId: validatedInput.actorId,
    };
  },
});

// Step 2: Execute schema update through catalogue tool
const executeSchemaUpdateStep = createStep({
  id: "execute-schema-update",
  description: "Execute catalogue schema update through the tool",
  inputSchema: z.object({
    validatedInput: CatalogueSyncInputSchema,
    catalogueRequest: z.any(),
    actorId: z.string(),
  }),
  outputSchema: z.object({
    validatedInput: CatalogueSyncInputSchema,
    catalogueRequest: z.any(),
    actorId: z.string(),
    schemaResponse: z.any(),
  }),
  execute: async ({ inputData }) => {
    const response = await catalogueSchemaToolImpl.processSchemaUpdate(
      inputData.catalogueRequest,
      inputData.actorId
    );

    return {
      ...inputData,
      schemaResponse: response,
    };
  },
});

// Step 3: Post-processing and notifications
const finalizeSyncStep = createStep({
  id: "finalize-sync",
  description: "Finalize sync with audit trail and summary",
  inputSchema: z.object({
    validatedInput: CatalogueSyncInputSchema,
    catalogueRequest: z.any(),
    actorId: z.string(),
    schemaResponse: z.any(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    ruleSetId: z.string(),
    version: z.number(),
    actions: z.array(z.any()),
    reminderActions: z.array(z.any()),
    auditEventId: z.string(),
    workflowAuditEventId: z.string(),
    summary: z.object({
      tablesCreated: z.number(),
      tablesModified: z.number(),
      tablesUnchanged: z.number(),
      remindersUpdated: z.number(),
    }),
  }),
  execute: async ({ inputData }) => {
    const prisma = getPrismaClient();

    // Update any additional metadata or trigger post-sync actions
    const finalAuditEvent = await prisma.auditEvent.create({
      data: {
        actorType: "system",
        actorId: "catalogue-sync-workflow",
        eventType: "workflow.catalogue_sync_completed",
        resourceRef: `admin_rule_set:${inputData.schemaResponse.ruleSetId}`,
        payload: {
          workflowResult: "success",
          originalRuleSetId: inputData.validatedInput.adminRuleSetId,
          newRuleSetId: inputData.schemaResponse.ruleSetId,
          version: inputData.schemaResponse.version,
          tableActions: inputData.schemaResponse.actions.length,
          reminderActions:
            inputData.schemaResponse.reminderActions?.length || 0,
          executedBy: inputData.actorId,
        },
      },
    });

    return {
      success: true,
      ruleSetId: inputData.schemaResponse.ruleSetId,
      version: inputData.schemaResponse.version,
      actions: inputData.schemaResponse.actions,
      reminderActions: inputData.schemaResponse.reminderActions || [],
      auditEventId: inputData.schemaResponse.auditEventId,
      workflowAuditEventId: finalAuditEvent.id,
      summary: {
        tablesCreated: inputData.schemaResponse.actions.filter(
          (a: any) => a.type === "create_table"
        ).length,
        tablesModified: inputData.schemaResponse.actions.filter(
          (a: any) => a.type === "alter_table_add_columns"
        ).length,
        tablesUnchanged: inputData.schemaResponse.actions.filter(
          (a: any) => a.type === "no_change"
        ).length,
        remindersUpdated: inputData.schemaResponse.reminderActions?.length || 0,
      },
    };
  },
});

/**
 * Catalogue Sync Workflow
 *
 * Orchestrates the complete catalogue synchronization process:
 * 1. Schema publication and versioning
 * 2. Dynamic table creation/updates
 * 3. Reminder rule synchronization
 * 4. Audit trail creation
 *
 * This workflow coordinates multiple services to ensure data consistency
 * when admin caregivers update the tracking catalogue configuration.
 */
export const catalogueSyncWorkflow = createWorkflow({
  id: "catalogue-sync",
  inputSchema: CatalogueSyncInputSchema,
  outputSchema: z.object({
    success: z.boolean(),
    ruleSetId: z.string(),
    version: z.number(),
    actions: z.array(z.any()),
    reminderActions: z.array(z.any()),
    auditEventId: z.string(),
    workflowAuditEventId: z.string(),
    summary: z.object({
      tablesCreated: z.number(),
      tablesModified: z.number(),
      tablesUnchanged: z.number(),
      remindersUpdated: z.number(),
    }),
  }),
})
  .then(validateInputStep)
  .then(executeSchemaUpdateStep)
  .then(finalizeSyncStep);

catalogueSyncWorkflow.commit();

// Export types for use in other modules
export type { CatalogueSyncInput };
export { CatalogueSyncInputSchema };
