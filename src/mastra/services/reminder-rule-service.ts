import { z } from "zod";
import { PrismaClient, Prisma } from "@prisma/client";
import { getPrismaClient } from "../lib/prisma-client.js";

// Schema for reminder synchronization actions
export const ReminderSyncActionSchema = z.union([
  z.object({
    type: z.literal("upsert_rule"),
    reminderRuleId: z.string(),
    catalogueItemId: z.string(),
    schedule: z.string(),
    timezone: z.string(),
    deliveryChannel: z.enum(["user_bot", "caregiver_bot"]),
    escalationPolicy: z.record(z.string(), z.any()).optional(),
  }),
  z.object({
    type: z.literal("disable_rule"),
    reminderRuleId: z.string(),
  }),
  z.object({
    type: z.literal("no_change"),
    reminderRuleId: z.string(),
  }),
]);

export type ReminderSyncAction = z.infer<typeof ReminderSyncActionSchema>;

// Schema for reminder policy from admin configuration
export const ReminderPolicySchema = z.object({
  schedule: z.string(),
  timezone: z.string(),
  escalation: z
    .object({
      notifyCaregiverAfterMinutes: z.number().optional(),
      notifyAdminAfterMinutes: z.number().optional(),
    })
    .optional(),
});

export type ReminderPolicy = z.infer<typeof ReminderPolicySchema>;

/**
 * Service for synchronizing reminder rules based on admin catalogue updates
 * Handles upsert/disable operations with Prisma transactions
 */
export class ReminderRuleService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  /**
   * Synchronize reminder rules for a given catalogue item
   * Returns actions taken for audit logging
   */
  async syncReminderRules(
    catalogueItemId: string,
    reminderPolicy: ReminderPolicy | null,
    auditActor: string
  ): Promise<{
    actions: ReminderSyncAction[];
    auditEventId: string;
  }> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        return await this.syncReminderRulesWithTransaction(
          tx,
          catalogueItemId,
          reminderPolicy,
          auditActor
        );
      }
    );
  }

  /**
   * Sync reminder rules within an existing transaction
   */
  async syncReminderRulesWithTransaction(
    tx: Prisma.TransactionClient,
    catalogueItemId: string,
    reminderPolicy: ReminderPolicy | null,
    auditActor: string
  ): Promise<{
    actions: ReminderSyncAction[];
    auditEventId: string;
  }> {
    const actions: ReminderSyncAction[] = [];
    // Find existing reminder rules for this catalogue item
    const existingRules = await tx.reminderRule.findMany({
      where: { catalogueItemId },
    });

    if (!reminderPolicy) {
      // Disable all existing rules if no policy provided
      for (const rule of existingRules) {
        if (rule.active) {
          await tx.reminderRule.update({
            where: { id: rule.id },
            data: { active: false },
          });

          actions.push({
            type: "disable_rule",
            reminderRuleId: rule.id,
          });
        }
      }
    } else {
      // Check if we need to create or update a rule
      const existingActiveRule = existingRules.find((rule: any) => rule.active);

      if (existingActiveRule) {
        // Check if update is needed
        const needsUpdate =
          existingActiveRule.scheduleCron !== reminderPolicy.schedule ||
          existingActiveRule.timezone !== reminderPolicy.timezone ||
          JSON.stringify(existingActiveRule.escalationPolicy) !==
            JSON.stringify(reminderPolicy.escalation || {});

        if (needsUpdate) {
          await tx.reminderRule.update({
            where: { id: existingActiveRule.id },
            data: {
              scheduleCron: reminderPolicy.schedule,
              timezone: reminderPolicy.timezone,
              escalationPolicy: reminderPolicy.escalation || {},
            },
          });

          actions.push({
            type: "upsert_rule",
            reminderRuleId: existingActiveRule.id,
            catalogueItemId,
            schedule: reminderPolicy.schedule,
            timezone: reminderPolicy.timezone,
            deliveryChannel: "user_bot", // Default channel
            escalationPolicy: reminderPolicy.escalation,
          });
        } else {
          actions.push({
            type: "no_change",
            reminderRuleId: existingActiveRule.id,
          });
        }
      } else {
        // Create new rule
        const newRule = await tx.reminderRule.create({
          data: {
            catalogueItemId,
            scheduleCron: reminderPolicy.schedule,
            timezone: reminderPolicy.timezone,
            deliveryChannel: "user_bot",
            escalationPolicy: reminderPolicy.escalation || {},
            active: true,
          },
        });

        actions.push({
          type: "upsert_rule",
          reminderRuleId: newRule.id,
          catalogueItemId,
          schedule: reminderPolicy.schedule,
          timezone: reminderPolicy.timezone,
          deliveryChannel: "user_bot",
          escalationPolicy: reminderPolicy.escalation,
        });
      }

      // Disable any other active rules for this catalogue item
      for (const rule of existingRules) {
        if (rule.active && rule.id !== existingActiveRule?.id) {
          await tx.reminderRule.update({
            where: { id: rule.id },
            data: { active: false },
          });

          actions.push({
            type: "disable_rule",
            reminderRuleId: rule.id,
          });
        }
      }
    }

    // Create audit event
    const auditEvent = await tx.auditEvent.create({
      data: {
        actorType: "system",
        eventType: "reminder.sync_rules",
        resourceRef: `catalogue_item:${catalogueItemId}`,
        payload: {
          catalogueItemId,
          reminderPolicy,
          actions: actions.map((action) => ({
            type: action.type,
            reminderRuleId: action.reminderRuleId,
          })),
        },
      },
    });

    return {
      actions,
      auditEventId: auditEvent.id,
    };
  }

  /**
   * Get all active reminder rules for a catalogue item
   */
  async getActiveReminderRules(catalogueItemId: string) {
    return await this.prisma.reminderRule.findMany({
      where: {
        catalogueItemId,
        active: true,
      },
      orderBy: {
        id: "desc",
      },
    });
  }

  /**
   * Bulk sync reminder rules for multiple catalogue items
   * Used when processing full admin rule set updates
   */
  async bulkSyncReminderRules(
    catalogueItems: Array<{
      catalogueItemId: string;
      reminderPolicy: ReminderPolicy | null;
    }>,
    auditActor: string
  ): Promise<{
    allActions: ReminderSyncAction[];
    auditEventIds: string[];
  }> {
    const allActions: ReminderSyncAction[] = [];
    const auditEventIds: string[] = [];

    for (const item of catalogueItems) {
      const result = await this.syncReminderRules(
        item.catalogueItemId,
        item.reminderPolicy,
        auditActor
      );

      allActions.push(...result.actions);
      auditEventIds.push(result.auditEventId);
    }

    return {
      allActions,
      auditEventIds,
    };
  }

  /**
   * Helper to parse cron schedule string and validate timezone
   */
  static validateReminderPolicy(policy: ReminderPolicy): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic cron validation (simplified)
    const cronParts = policy.schedule.split(" ");
    if (cronParts.length !== 5 && cronParts.length !== 6) {
      errors.push("Schedule must be a valid cron expression (5 or 6 parts)");
    }

    // Timezone validation
    try {
      Intl.DateTimeFormat(undefined, { timeZone: policy.timezone });
    } catch {
      errors.push(`Invalid timezone: ${policy.timezone}`);
    }

    // Escalation validation
    if (policy.escalation) {
      if (
        policy.escalation.notifyCaregiverAfterMinutes !== undefined &&
        policy.escalation.notifyCaregiverAfterMinutes < 0
      ) {
        errors.push("Caregiver notification delay must be non-negative");
      }

      if (
        policy.escalation.notifyAdminAfterMinutes !== undefined &&
        policy.escalation.notifyAdminAfterMinutes < 0
      ) {
        errors.push("Admin notification delay must be non-negative");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const reminderRuleService = new ReminderRuleService();
