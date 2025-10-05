import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Contract types from the specification
export const JournalWriterRequestSchema = z.object({
  userId: z.string(),
  telegramMessageId: z.string(),
  receivedAt: z.string(),
  catalogueItemSlug: z.string(),
  healthWeekLabel: z.enum(["healthy", "unhealthy"]).optional(),
  parsedFields: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
      confidence: z.number().min(0).max(1),
      unit: z.string().optional(),
    })
  ),
  freeformNotes: z.string().optional(),
});

export const JournalWriterResponseSchema = z.object({
  journalTable: z.string(),
  insertedRecordId: z.string(),
  normalizedFields: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
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

describe("journalWriterTool Contract", () => {
  // Mock implementation - to be replaced with actual tool once implemented
  const mockJournalWriterTool = async (
    request: JournalWriterRequest
  ): Promise<JournalWriterResponse> => {
    // Validate input
    JournalWriterRequestSchema.parse(request);

    // Mock response based on request
    const prompts: Array<{
      type: "missing_field" | "low_confidence" | "follow_up";
      message: string;
    }> = [];

    // Check for low confidence fields
    request.parsedFields.forEach((field) => {
      if (field.confidence < 0.7) {
        prompts.push({
          type: "low_confidence",
          message: `I'm not sure about the ${field.name} value. Did you mean ${field.value}?`,
        });
      }
    });

    return {
      journalTable: `journal_${request.catalogueItemSlug.replace("-", "_")}`,
      insertedRecordId: "test-record-id",
      normalizedFields: request.parsedFields.map((field) => ({
        name: field.name,
        value: field.value,
      })),
      promptsIssued: prompts,
      auditEventId: "test-audit-event-id",
    };
  };

  const mockJournalWriterToolWithError = async (
    request: JournalWriterRequest
  ): Promise<never> => {
    throw {
      code: "CONSENT_REVOKED",
      message: "User has revoked consent for data collection",
      remediation: "Please re-consent to continue journaling",
    } as JournalWriterError;
  };

  beforeEach(() => {
    // Setup test database or mocks
  });

  afterEach(() => {
    // Cleanup
  });

  it("should handle successful journal entry with complete data", async () => {
    const request: JournalWriterRequest = {
      userId: "test-user-id",
      telegramMessageId: "msg_12345",
      receivedAt: new Date().toISOString(),
      catalogueItemSlug: "water-intake",
      healthWeekLabel: "healthy",
      parsedFields: [
        {
          name: "quantity",
          value: 500,
          confidence: 0.95,
          unit: "ml",
        },
        {
          name: "source",
          value: "filtered",
          confidence: 0.9,
        },
      ],
      freeformNotes: "Had a glass of filtered water after workout",
    };

    const response = await mockJournalWriterTool(request);

    // Validate response structure
    expect(JournalWriterResponseSchema.safeParse(response).success).toBe(true);

    // Validate specific contract requirements
    expect(response.journalTable).toBe("journal_water_intake");
    expect(response.insertedRecordId).toBeDefined();
    expect(response.normalizedFields).toHaveLength(2);
    expect(response.normalizedFields[0].name).toBe("quantity");
    expect(response.normalizedFields[0].value).toBe(500);
    expect(response.promptsIssued).toHaveLength(0); // High confidence, no prompts
    expect(response.auditEventId).toBeDefined();
  });

  it("should issue low confidence prompts when field confidence is low", async () => {
    const request: JournalWriterRequest = {
      userId: "test-user-id",
      telegramMessageId: "msg_12346",
      receivedAt: new Date().toISOString(),
      catalogueItemSlug: "medication-adherence",
      parsedFields: [
        {
          name: "taken",
          value: true,
          confidence: 0.6, // Low confidence
        },
        {
          name: "dosage",
          value: "10mg",
          confidence: 0.5, // Very low confidence
        },
      ],
    };

    const response = await mockJournalWriterTool(request);

    expect(response.promptsIssued).toHaveLength(2);
    expect(response.promptsIssued[0].type).toBe("low_confidence");
    expect(response.promptsIssued[0].message).toContain("not sure about");
    expect(response.promptsIssued[1].type).toBe("low_confidence");
  });

  it("should handle missing required fields with follow-up prompts", async () => {
    const mockWithMissingFields = async (
      request: JournalWriterRequest
    ): Promise<JournalWriterResponse> => {
      // Simulate that 'quantity' is required but missing
      const prompts = [];
      const hasQuantity = request.parsedFields.some(
        (field) => field.name === "quantity"
      );

      if (!hasQuantity) {
        prompts.push({
          type: "missing_field" as const,
          message:
            "How much water did you drink? Please specify the quantity in ml or cups.",
        });
      }

      return {
        journalTable: `journal_${request.catalogueItemSlug.replace("-", "_")}`,
        insertedRecordId: "partial-record-id",
        normalizedFields: request.parsedFields.map((field) => ({
          name: field.name,
          value: field.value,
        })),
        promptsIssued: prompts,
        auditEventId: "partial-audit-event-id",
      };
    };

    const request: JournalWriterRequest = {
      userId: "test-user-id",
      telegramMessageId: "msg_12347",
      receivedAt: new Date().toISOString(),
      catalogueItemSlug: "water-intake",
      parsedFields: [
        // Missing 'quantity' field
        {
          name: "source",
          value: "tap",
          confidence: 0.9,
        },
      ],
    };

    const response = await mockWithMissingFields(request);

    expect(response.promptsIssued).toHaveLength(1);
    expect(response.promptsIssued[0].type).toBe("missing_field");
    expect(response.promptsIssued[0].message).toContain("How much water");
  });

  it("should handle consent revocation error", async () => {
    const request: JournalWriterRequest = {
      userId: "consent-revoked-user-id",
      telegramMessageId: "msg_12348",
      receivedAt: new Date().toISOString(),
      catalogueItemSlug: "water-intake",
      parsedFields: [
        {
          name: "quantity",
          value: 300,
          confidence: 0.9,
        },
      ],
    };

    await expect(mockJournalWriterToolWithError(request)).rejects.toMatchObject(
      {
        code: "CONSENT_REVOKED",
        message: expect.stringContaining("revoked consent"),
        remediation: expect.stringContaining("re-consent"),
      }
    );
  });

  it("should handle unknown catalogue item error", async () => {
    const mockWithUnknownItem = async (
      request: JournalWriterRequest
    ): Promise<never> => {
      throw {
        code: "UNKNOWN_CATALOGUE_ITEM",
        message: `Catalogue item '${request.catalogueItemSlug}' not found`,
        remediation:
          "Please check the available tracking categories or ask an admin to configure this metric.",
      } as JournalWriterError;
    };

    const request: JournalWriterRequest = {
      userId: "test-user-id",
      telegramMessageId: "msg_12349",
      receivedAt: new Date().toISOString(),
      catalogueItemSlug: "unknown-metric",
      parsedFields: [
        {
          name: "value",
          value: "some value",
          confidence: 0.9,
        },
      ],
    };

    await expect(mockWithUnknownItem(request)).rejects.toMatchObject({
      code: "UNKNOWN_CATALOGUE_ITEM",
      message: expect.stringContaining("unknown-metric"),
    });
  });

  it("should validate required fields in request", async () => {
    const invalidRequest = {
      userId: "test-user-id",
      // Missing required fields like telegramMessageId
      catalogueItemSlug: "water-intake",
      parsedFields: [],
    };

    expect(() => JournalWriterRequestSchema.parse(invalidRequest)).toThrow();
  });

  it("should validate response schema compliance", async () => {
    const invalidResponse = {
      journalTable: "journal_water_intake",
      // Missing insertedRecordId and other required fields
    };

    expect(JournalWriterResponseSchema.safeParse(invalidResponse).success).toBe(
      false
    );
  });

  it("should handle health week labeling", async () => {
    const request: JournalWriterRequest = {
      userId: "test-user-id",
      telegramMessageId: "msg_12350",
      receivedAt: new Date().toISOString(),
      catalogueItemSlug: "mood-tracking",
      healthWeekLabel: "unhealthy",
      parsedFields: [
        {
          name: "mood_level",
          value: 3,
          confidence: 0.8,
        },
      ],
    };

    const response = await mockJournalWriterTool(request);

    expect(response.journalTable).toBe("journal_mood_tracking");
    expect(response.insertedRecordId).toBeDefined();
    // Health week label would be stored in the database record
  });
});
