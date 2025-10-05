import { describe, it, expect } from "vitest";
import { z } from "zod";

// Parser input/output schemas for testing
export const AdminTextInputSchema = z.object({
  sourceText: z.string(),
  ruleSetId: z.string().nullable(),
});

export const ParsedCatalogueSchema = z.object({
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
  confidence: z.number().min(0).max(1),
});

export type AdminTextInput = z.infer<typeof AdminTextInputSchema>;
export type ParsedCatalogue = z.infer<typeof ParsedCatalogueSchema>;

describe("Catalogue Schema Parser", () => {
  // Mock parser implementation - to be replaced with actual parser
  const mockParseAdminText = (input: AdminTextInput): ParsedCatalogue => {
    AdminTextInputSchema.parse(input);

    // Simple text parsing mock - would use LLM or sophisticated NLP in real implementation
    const text = input.sourceText.toLowerCase();

    let metrics = [];
    let retention = { journalRetentionDays: 365, documentRetentionDays: 180 }; // defaults

    // Mock parsing logic
    if (text.includes("water") && text.includes("intake")) {
      metrics.push({
        slug: "water-intake",
        displayName: "Water Intake",
        description: "Daily water consumption tracking",
        fields: [
          {
            name: "quantity",
            label: "Quantity",
            dataType: "numeric" as const,
            unit: text.includes("ml")
              ? "ml"
              : text.includes("cups")
                ? "cups"
                : "ml",
            required: true,
          },
          ...(text.includes("source") || text.includes("type")
            ? [
                {
                  name: "source",
                  label: "Water Source",
                  dataType: "enum" as const,
                  enumValues: ["tap", "bottled", "filtered"],
                  required: false,
                },
              ]
            : []),
        ],
        reminderPolicy: {
          schedule: text.includes("hourly")
            ? "0 * * * *"
            : text.includes("3 times")
              ? "0 8,14,20 * * *"
              : "0 8,20 * * *", // default 2x daily
          timezone: "America/New_York",
          ...(text.includes("escalat")
            ? {
                escalation: { notifyCaregiverAfterMinutes: 60 },
              }
            : {}),
        },
        analyticsTags: ["hydration", "wellness"],
      });
    }

    if (text.includes("medication") || text.includes("pill")) {
      metrics.push({
        slug: "medication-adherence",
        displayName: "Medication Adherence",
        description: "Medication taking compliance tracking",
        fields: [
          {
            name: "taken",
            label: "Taken",
            dataType: "boolean" as const,
            required: true,
          },
          {
            name: "time_taken",
            label: "Time Taken",
            dataType: "datetime" as const,
            required: false,
          },
          ...(text.includes("dosage") || text.includes("dose")
            ? [
                {
                  name: "dosage",
                  label: "Dosage",
                  dataType: "text" as const,
                  required: false,
                },
              ]
            : []),
        ],
        reminderPolicy: {
          schedule: "0 9,21 * * *", // 9 AM and 9 PM
          timezone: "America/New_York",
          escalation: { notifyCaregiverAfterMinutes: 30 },
        },
        analyticsTags: ["medication", "adherence", "health"],
      });
    }

    // Parse retention if mentioned
    const retentionMatch = text.match(/keep.*?(\d+)\s*days/);
    if (retentionMatch) {
      retention.journalRetentionDays = parseInt(retentionMatch[1]);
    }

    // Calculate confidence based on parsing success
    const confidence = metrics.length > 0 ? 0.85 : 0.3;

    return {
      metrics,
      retention,
      confidence,
    };
  };

  it("should parse simple water intake instruction", () => {
    const input: AdminTextInput = {
      sourceText:
        "Track water intake with quantity in ml, remind users 3 times daily",
      ruleSetId: null,
    };

    const result = mockParseAdminText(input);

    expect(ParsedCatalogueSchema.safeParse(result).success).toBe(true);
    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].slug).toBe("water-intake");
    expect(result.metrics[0].fields[0].name).toBe("quantity");
    expect(result.metrics[0].fields[0].unit).toBe("ml");
    expect(result.metrics[0].reminderPolicy.schedule).toBe("0 8,14,20 * * *");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("should parse medication adherence with escalation", () => {
    const input: AdminTextInput = {
      sourceText:
        "Track medication taking, include dosage info, escalate to caregiver if missed",
      ruleSetId: "existing-rule-set",
    };

    const result = mockParseAdminText(input);

    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].slug).toBe("medication-adherence");
    expect(result.metrics[0].fields.some((f) => f.name === "taken")).toBe(true);
    expect(result.metrics[0].fields.some((f) => f.name === "dosage")).toBe(
      true
    );
    expect(
      result.metrics[0].reminderPolicy.escalation?.notifyCaregiverAfterMinutes
    ).toBe(30);
  });

  it("should parse complex multi-metric instruction", () => {
    const input: AdminTextInput = {
      sourceText:
        "Set up tracking for water intake in cups and medication adherence with dosage. Keep data for 90 days.",
      ruleSetId: null,
    };

    const result = mockParseAdminText(input);

    expect(result.metrics).toHaveLength(2);
    expect(result.metrics[0].slug).toBe("water-intake");
    expect(result.metrics[0].fields[0].unit).toBe("cups");
    expect(result.metrics[1].slug).toBe("medication-adherence");
    expect(result.retention.journalRetentionDays).toBe(90);
  });

  it("should handle water intake with source type specification", () => {
    const input: AdminTextInput = {
      sourceText:
        "Track water intake with source type (tap, bottled, filtered) and quantity in ml",
      ruleSetId: null,
    };

    const result = mockParseAdminText(input);

    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0].fields).toHaveLength(2);
    expect(result.metrics[0].fields[1].name).toBe("source");
    expect(result.metrics[0].fields[1].dataType).toBe("enum");
    expect(result.metrics[0].fields[1].enumValues).toEqual([
      "tap",
      "bottled",
      "filtered",
    ]);
  });

  it("should return low confidence for unclear instructions", () => {
    const input: AdminTextInput = {
      sourceText: "Something about tracking stuff maybe",
      ruleSetId: null,
    };

    const result = mockParseAdminText(input);

    expect(result.metrics).toHaveLength(0);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it("should validate required schema fields", () => {
    const validResult = mockParseAdminText({
      sourceText: "Track water intake",
      ruleSetId: null,
    });

    expect(validResult.metrics).toBeDefined();
    expect(validResult.retention).toBeDefined();
    expect(validResult.confidence).toBeDefined();
    expect(typeof validResult.confidence).toBe("number");
    expect(validResult.confidence).toBeGreaterThanOrEqual(0);
    expect(validResult.confidence).toBeLessThanOrEqual(1);
  });

  it("should handle field requirement specifications", () => {
    const input: AdminTextInput = {
      sourceText:
        "Track water intake where quantity is required and source is optional",
      ruleSetId: null,
    };

    const result = mockParseAdminText(input);

    expect(result.metrics[0].fields[0].required).toBe(true); // quantity
    expect(result.metrics[0].fields[1].required).toBe(false); // source
  });

  it("should extract analytics tags appropriately", () => {
    const input: AdminTextInput = {
      sourceText: "Track water intake for hydration wellness monitoring",
      ruleSetId: null,
    };

    const result = mockParseAdminText(input);

    expect(result.metrics[0].analyticsTags).toContain("hydration");
    expect(result.metrics[0].analyticsTags).toContain("wellness");
  });

  it("should generate appropriate reminder schedules", () => {
    const hourlyInput: AdminTextInput = {
      sourceText: "Track water intake hourly",
      ruleSetId: null,
    };

    const hourlyResult = mockParseAdminText(hourlyInput);
    expect(hourlyResult.metrics[0].reminderPolicy.schedule).toBe("0 * * * *");

    const defaultInput: AdminTextInput = {
      sourceText: "Track water intake",
      ruleSetId: null,
    };

    const defaultResult = mockParseAdminText(defaultInput);
    expect(defaultResult.metrics[0].reminderPolicy.schedule).toBe(
      "0 8,20 * * *"
    );
  });
});
