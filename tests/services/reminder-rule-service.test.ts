import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";

// Types for reminder synchronization
export const ReminderRuleSchema = z.object({
  id: z.string(),
  catalogueItemId: z.string(),
  scheduleCron: z.string(),
  timezone: z.string(),
  deliveryChannel: z.enum(["user_bot", "caregiver_bot"]),
  escalationPolicy: z.record(z.string(), z.any()),
  active: z.boolean(),
});

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

export type ReminderRule = z.infer<typeof ReminderRuleSchema>;
export type ReminderSyncAction = z.infer<typeof ReminderSyncActionSchema>;

interface MockPrismaClient {
  $transaction: ReturnType<typeof vi.fn>;
  reminderRule: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
  auditEvent: {
    create: ReturnType<typeof vi.fn>;
  };
}

describe("Reminder Rule Service", () => {
  let mockPrismaClient: MockPrismaClient;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  // Mock reminder rule service - to be replaced with actual implementation
  const mockReminderRuleService = {
    async planReminderSync(
      catalogueItemId: string,
      newReminderPolicy: {
        schedule: string;
        timezone: string;
        escalation?: any;
        deliveryChannel?: "user_bot" | "caregiver_bot";
      }
    ): Promise<ReminderSyncAction> {
      // Check for existing rules
      const existingRules = (await mockPrismaClient.reminderRule.findMany({
        where: { catalogueItemId, active: true },
      })) as Array<{
        id: string;
        catalogueItemId: string;
        scheduleCron: string;
        timezone: string;
        deliveryChannel: "user_bot" | "caregiver_bot";
        escalationPolicy: any;
        active: boolean;
      }>;

      if (existingRules.length === 0) {
        return {
          type: "upsert_rule",
          reminderRuleId: "new-rule-id",
          catalogueItemId,
          schedule: newReminderPolicy.schedule,
          timezone: newReminderPolicy.timezone,
          deliveryChannel: newReminderPolicy.deliveryChannel || "user_bot",
          escalationPolicy: newReminderPolicy.escalation,
        };
      }

      const existingRule = existingRules[0];

      // Check if rule needs updating
      if (
        existingRule.scheduleCron !== newReminderPolicy.schedule ||
        existingRule.timezone !== newReminderPolicy.timezone
      ) {
        return {
          type: "upsert_rule",
          reminderRuleId: existingRule.id,
          catalogueItemId,
          schedule: newReminderPolicy.schedule,
          timezone: newReminderPolicy.timezone,
          deliveryChannel:
            newReminderPolicy.deliveryChannel || existingRule.deliveryChannel,
          escalationPolicy: newReminderPolicy.escalation,
        };
      }

      return {
        type: "no_change",
        reminderRuleId: existingRule.id,
      };
    },

    async executeReminderSync(
      action: ReminderSyncAction,
      adminRuleSetId: string
    ): Promise<string> {
      const result = (await mockPrismaClient.$transaction(async (tx: any) => {
        if (action.type === "upsert_rule") {
          await tx.reminderRule.upsert({
            where: { id: action.reminderRuleId },
            create: {
              id: action.reminderRuleId,
              catalogueItemId: action.catalogueItemId,
              scheduleCron: action.schedule,
              timezone: action.timezone,
              deliveryChannel: action.deliveryChannel,
              escalationPolicy: action.escalationPolicy || {},
              active: true,
            },
            update: {
              scheduleCron: action.schedule,
              timezone: action.timezone,
              deliveryChannel: action.deliveryChannel,
              escalationPolicy: action.escalationPolicy || {},
              active: true,
            },
          });

          const auditEvent = await tx.auditEvent.create({
            data: {
              actorType: "admin",
              eventType: "reminder.rule_upserted",
              resourceRef: action.reminderRuleId,
              payload: { action, adminRuleSetId },
            },
          });

          return auditEvent.id;
        }

        if (action.type === "disable_rule") {
          await tx.reminderRule.update({
            where: { id: action.reminderRuleId },
            data: { active: false },
          });

          const auditEvent = await tx.auditEvent.create({
            data: {
              actorType: "admin",
              eventType: "reminder.rule_disabled",
              resourceRef: action.reminderRuleId,
              payload: { action, adminRuleSetId },
            },
          });

          return auditEvent.id;
        }

        // No change
        const auditEvent = await tx.auditEvent.create({
          data: {
            actorType: "admin",
            eventType: "reminder.no_change",
            resourceRef: action.reminderRuleId,
            payload: { action, adminRuleSetId },
          },
        });

        return auditEvent.id;
      })) as string;
      return result;
    },

    async disableOrphanedRules(
      catalogueItemIds: string[],
      adminRuleSetId: string
    ): Promise<string[]> {
      // Find rules that are active but not in the current catalogue items
      const orphanedRules = (await mockPrismaClient.reminderRule.findMany({
        where: {
          active: true,
          catalogueItemId: { notIn: catalogueItemIds },
        },
      })) as Array<{ id: string; catalogueItemId: string }>;

      const auditEventIds: string[] = [];

      for (const rule of orphanedRules) {
        const action: ReminderSyncAction = {
          type: "disable_rule",
          reminderRuleId: rule.id,
        };

        const auditEventId = await this.executeReminderSync(
          action,
          adminRuleSetId
        );
        auditEventIds.push(auditEventId);
      }

      return auditEventIds;
    },
  };

  beforeEach(() => {
    mockPrismaClient = {
      $transaction: vi.fn((fn) => fn(mockPrismaClient)),
      reminderRule: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      auditEvent: {
        create: vi.fn(),
      },
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should plan upsert for new reminder rule", async () => {
    // Mock no existing rules
    mockPrismaClient.reminderRule.findMany.mockResolvedValue([]);

    const catalogueItemId = "water-intake-item-id";
    const reminderPolicy = {
      schedule: "0 8,14,20 * * *",
      timezone: "America/New_York",
      escalation: { notifyCaregiverAfterMinutes: 60 },
    };

    const action = await mockReminderRuleService.planReminderSync(
      catalogueItemId,
      reminderPolicy
    );

    expect(action.type).toBe("upsert_rule");
    if (action.type === "upsert_rule") {
      expect(action.catalogueItemId).toBe(catalogueItemId);
      expect(action.schedule).toBe("0 8,14,20 * * *");
      expect(action.timezone).toBe("America/New_York");
      expect(action.deliveryChannel).toBe("user_bot");
      expect(action.escalationPolicy).toEqual({
        notifyCaregiverAfterMinutes: 60,
      });
    }
  });

  it("should plan upsert for changed reminder rule", async () => {
    // Mock existing rule with different schedule
    const existingRule = {
      id: "existing-rule-id",
      catalogueItemId: "water-intake-item-id",
      scheduleCron: "0 8,20 * * *", // Different from new schedule
      timezone: "America/New_York",
      deliveryChannel: "user_bot",
      escalationPolicy: {},
      active: true,
    };

    mockPrismaClient.reminderRule.findMany.mockResolvedValue([existingRule]);

    const catalogueItemId = "water-intake-item-id";
    const reminderPolicy = {
      schedule: "0 8,14,20 * * *", // New schedule
      timezone: "America/New_York",
    };

    const action = await mockReminderRuleService.planReminderSync(
      catalogueItemId,
      reminderPolicy
    );

    expect(action.type).toBe("upsert_rule");
    if (action.type === "upsert_rule") {
      expect(action.reminderRuleId).toBe("existing-rule-id");
      expect(action.schedule).toBe("0 8,14,20 * * *");
    }
  });

  it("should plan no_change for identical reminder rule", async () => {
    // Mock existing rule identical to new policy
    const existingRule = {
      id: "existing-rule-id",
      catalogueItemId: "water-intake-item-id",
      scheduleCron: "0 8,14,20 * * *",
      timezone: "America/New_York",
      deliveryChannel: "user_bot",
      escalationPolicy: {},
      active: true,
    };

    mockPrismaClient.reminderRule.findMany.mockResolvedValue([existingRule]);

    const catalogueItemId = "water-intake-item-id";
    const reminderPolicy = {
      schedule: "0 8,14,20 * * *", // Same schedule
      timezone: "America/New_York", // Same timezone
    };

    const action = await mockReminderRuleService.planReminderSync(
      catalogueItemId,
      reminderPolicy
    );

    expect(action.type).toBe("no_change");
    if (action.type === "no_change") {
      expect(action.reminderRuleId).toBe("existing-rule-id");
    }
  });

  it("should execute upsert rule action with transaction", async () => {
    const action: ReminderSyncAction = {
      type: "upsert_rule",
      reminderRuleId: "test-rule-id",
      catalogueItemId: "water-intake-item-id",
      schedule: "0 8,14,20 * * *",
      timezone: "America/New_York",
      deliveryChannel: "user_bot",
      escalationPolicy: { notifyCaregiverAfterMinutes: 60 },
    };

    mockPrismaClient.reminderRule.upsert.mockResolvedValue({
      id: "test-rule-id",
    });
    mockPrismaClient.auditEvent.create.mockResolvedValue({
      id: "audit-event-id",
    });

    const auditEventId = await mockReminderRuleService.executeReminderSync(
      action,
      "rule-set-id"
    );

    expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    expect(mockPrismaClient.reminderRule.upsert).toHaveBeenCalledWith({
      where: { id: "test-rule-id" },
      create: expect.objectContaining({
        id: "test-rule-id",
        catalogueItemId: "water-intake-item-id",
        scheduleCron: "0 8,14,20 * * *",
        timezone: "America/New_York",
        deliveryChannel: "user_bot",
        active: true,
      }),
      update: expect.objectContaining({
        scheduleCron: "0 8,14,20 * * *",
        timezone: "America/New_York",
        deliveryChannel: "user_bot",
        active: true,
      }),
    });
    expect(mockPrismaClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "admin",
        eventType: "reminder.rule_upserted",
        resourceRef: "test-rule-id",
      }),
    });
    expect(auditEventId).toBe("audit-event-id");
  });

  it("should execute disable rule action", async () => {
    const action: ReminderSyncAction = {
      type: "disable_rule",
      reminderRuleId: "obsolete-rule-id",
    };

    mockPrismaClient.reminderRule.update.mockResolvedValue({
      id: "obsolete-rule-id",
    });
    mockPrismaClient.auditEvent.create.mockResolvedValue({
      id: "disable-audit-event-id",
    });

    const auditEventId = await mockReminderRuleService.executeReminderSync(
      action,
      "rule-set-id"
    );

    expect(mockPrismaClient.reminderRule.update).toHaveBeenCalledWith({
      where: { id: "obsolete-rule-id" },
      data: { active: false },
    });
    expect(mockPrismaClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "admin",
        eventType: "reminder.rule_disabled",
        resourceRef: "obsolete-rule-id",
      }),
    });
    expect(auditEventId).toBe("disable-audit-event-id");
  });

  it("should handle no_change action without database modifications", async () => {
    const action: ReminderSyncAction = {
      type: "no_change",
      reminderRuleId: "unchanged-rule-id",
    };

    mockPrismaClient.auditEvent.create.mockResolvedValue({
      id: "no-change-audit-event-id",
    });

    const auditEventId = await mockReminderRuleService.executeReminderSync(
      action,
      "rule-set-id"
    );

    expect(mockPrismaClient.reminderRule.upsert).not.toHaveBeenCalled();
    expect(mockPrismaClient.reminderRule.update).not.toHaveBeenCalled();
    expect(mockPrismaClient.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "admin",
        eventType: "reminder.no_change",
        resourceRef: "unchanged-rule-id",
      }),
    });
    expect(auditEventId).toBe("no-change-audit-event-id");
  });

  it("should disable orphaned rules when catalogue items are removed", async () => {
    const activeRules = [
      { id: "rule-1", catalogueItemId: "item-1", active: true },
      { id: "rule-2", catalogueItemId: "item-2", active: true },
      { id: "rule-3", catalogueItemId: "item-3", active: true },
    ];

    // Only item-1 and item-2 are in the new catalogue
    const currentCatalogueItemIds = ["item-1", "item-2"];

    // Mock finding orphaned rules (item-3 should be orphaned)
    mockPrismaClient.reminderRule.findMany.mockResolvedValue([
      { id: "rule-3", catalogueItemId: "item-3", active: true },
    ]);

    mockPrismaClient.auditEvent.create.mockResolvedValue({
      id: "orphan-audit-event-id",
    });
    mockPrismaClient.reminderRule.update.mockResolvedValue({ id: "rule-3" });

    const auditEventIds = await mockReminderRuleService.disableOrphanedRules(
      currentCatalogueItemIds,
      "rule-set-id"
    );

    expect(mockPrismaClient.reminderRule.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        catalogueItemId: { notIn: currentCatalogueItemIds },
      },
    });
    expect(auditEventIds).toHaveLength(1);
    expect(auditEventIds[0]).toBe("orphan-audit-event-id");
  });

  it("should validate reminder sync action schemas", () => {
    const validUpsertAction: ReminderSyncAction = {
      type: "upsert_rule",
      reminderRuleId: "test-rule-id",
      catalogueItemId: "item-id",
      schedule: "0 8 * * *",
      timezone: "UTC",
      deliveryChannel: "user_bot",
    };

    expect(ReminderSyncActionSchema.safeParse(validUpsertAction).success).toBe(
      true
    );

    const validDisableAction: ReminderSyncAction = {
      type: "disable_rule",
      reminderRuleId: "test-rule-id",
    };

    expect(ReminderSyncActionSchema.safeParse(validDisableAction).success).toBe(
      true
    );

    const validNoChangeAction: ReminderSyncAction = {
      type: "no_change",
      reminderRuleId: "test-rule-id",
    };

    expect(
      ReminderSyncActionSchema.safeParse(validNoChangeAction).success
    ).toBe(true);
  });

  it("should handle different delivery channels", async () => {
    mockPrismaClient.reminderRule.findMany.mockResolvedValue([]);

    const catalogueItemId = "medication-item-id";
    const reminderPolicy = {
      schedule: "0 9,21 * * *",
      timezone: "America/New_York",
      deliveryChannel: "caregiver_bot" as const,
      escalation: { notifyAdminAfterMinutes: 120 },
    };

    const action = await mockReminderRuleService.planReminderSync(
      catalogueItemId,
      reminderPolicy
    );

    expect(action.type).toBe("upsert_rule");
    if (action.type === "upsert_rule") {
      expect(action.deliveryChannel).toBe("caregiver_bot");
    }
  });

  it("should handle timezone changes in reminder updates", async () => {
    const existingRule = {
      id: "existing-rule-id",
      catalogueItemId: "water-intake-item-id",
      scheduleCron: "0 8,14,20 * * *",
      timezone: "America/New_York", // Different timezone
      deliveryChannel: "user_bot",
      escalationPolicy: {},
      active: true,
    };

    mockPrismaClient.reminderRule.findMany.mockResolvedValue([existingRule]);

    const catalogueItemId = "water-intake-item-id";
    const reminderPolicy = {
      schedule: "0 8,14,20 * * *", // Same schedule
      timezone: "Europe/London", // Different timezone
    };

    const action = await mockReminderRuleService.planReminderSync(
      catalogueItemId,
      reminderPolicy
    );

    expect(action.type).toBe("upsert_rule");
    if (action.type === "upsert_rule") {
      expect(action.timezone).toBe("Europe/London");
    }
  });
});
