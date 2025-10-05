import { z } from "zod";

// Input schema for admin text parsing
export const AdminTextInputSchema = z.object({
  sourceText: z.string().min(1, "Source text cannot be empty"),
  ruleSetId: z.string().nullable(),
  adminId: z.string().optional(),
});

// Field definition schema
export const FieldDefinitionSchema = z.object({
  name: z.string().regex(/^[a-z_][a-z0-9_]*$/, "Field name must be snake_case"),
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
  example: z.string().optional(),
});

// Reminder policy schema
export const ReminderPolicySchema = z.object({
  schedule: z.string(), // Cron expression or ISO8601 interval
  timezone: z.string().default("America/New_York"),
  escalation: z
    .object({
      notifyCaregiverAfterMinutes: z.number().positive().optional(),
      notifyAdminAfterMinutes: z.number().positive().optional(),
    })
    .optional(),
});

// Metric definition schema
export const MetricDefinitionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must be kebab-case"),
  displayName: z.string(),
  description: z.string(),
  fields: z
    .array(FieldDefinitionSchema)
    .min(1, "At least one field is required"),
  reminderPolicy: ReminderPolicySchema,
  analyticsTags: z.array(z.string()).default([]),
});

// Retention policy schema
export const RetentionPolicySchema = z.object({
  journalRetentionDays: z.number().int().positive().default(365),
  documentRetentionDays: z.number().int().positive().default(180),
});

// Complete parsed catalogue schema
export const ParsedCatalogueSchema = z.object({
  metrics: z.array(MetricDefinitionSchema),
  retention: RetentionPolicySchema,
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([]),
});

// DTO schemas for tool integration
export const CatalogueSchemaRequestSchema = z.object({
  adminRuleSetId: z.string().nullable(),
  parsedAt: z.string().datetime(),
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

// Type exports
export type AdminTextInput = z.infer<typeof AdminTextInputSchema>;
export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;
export type ReminderPolicy = z.infer<typeof ReminderPolicySchema>;
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;
export type RetentionPolicy = z.infer<typeof RetentionPolicySchema>;
export type ParsedCatalogue = z.infer<typeof ParsedCatalogueSchema>;
export type CatalogueSchemaRequest = z.infer<
  typeof CatalogueSchemaRequestSchema
>;

/**
 * Parse admin natural language text into structured catalogue definitions
 * This is a simplified rule-based parser - in production would use LLM-powered parsing
 */
export class CatalogueSchemaParser {
  private readonly commonKeywords = {
    metrics: {
      water: {
        slug: "water-intake",
        displayName: "Water Intake",
        tags: ["hydration", "wellness"],
      },
      medication: {
        slug: "medication-adherence",
        displayName: "Medication Adherence",
        tags: ["medication", "adherence", "health"],
      },
      mood: {
        slug: "mood-tracking",
        displayName: "Mood Tracking",
        tags: ["mental-health", "wellness"],
      },
      sleep: {
        slug: "sleep-tracking",
        displayName: "Sleep Tracking",
        tags: ["sleep", "recovery", "wellness"],
      },
      exercise: {
        slug: "exercise-tracking",
        displayName: "Exercise Tracking",
        tags: ["fitness", "activity", "wellness"],
      },
      "blood-pressure": {
        slug: "blood-pressure",
        displayName: "Blood Pressure",
        tags: ["vitals", "cardiovascular", "health"],
      },
    },
    fields: {
      quantity: {
        name: "quantity",
        label: "Quantity",
        dataType: "numeric" as const,
        required: true,
      },
      amount: {
        name: "amount",
        label: "Amount",
        dataType: "numeric" as const,
        required: true,
      },
      taken: {
        name: "taken",
        label: "Taken",
        dataType: "boolean" as const,
        required: true,
      },
      dosage: {
        name: "dosage",
        label: "Dosage",
        dataType: "text" as const,
        required: false,
      },
      time: {
        name: "time_taken",
        label: "Time Taken",
        dataType: "datetime" as const,
        required: false,
      },
      source: {
        name: "source",
        label: "Source",
        dataType: "enum" as const,
        enumValues: ["tap", "bottled", "filtered"],
        required: false,
      },
      mood_level: {
        name: "mood_level",
        label: "Mood Level",
        dataType: "integer" as const,
        required: true,
      },
      hours: {
        name: "hours",
        label: "Hours",
        dataType: "numeric" as const,
        required: true,
      },
      quality: {
        name: "quality",
        label: "Quality",
        dataType: "enum" as const,
        enumValues: ["poor", "fair", "good", "excellent"],
        required: false,
      },
    },
    units: {
      ml: "ml",
      milliliters: "ml",
      cups: "cups",
      glasses: "glasses",
      liters: "l",
      mg: "mg",
      milligrams: "mg",
      hours: "hours",
      minutes: "minutes",
    },
    schedules: {
      hourly: "0 * * * *",
      daily: "0 8 * * *",
      "twice daily": "0 8,20 * * *",
      "3 times": "0 8,14,20 * * *",
      morning: "0 8 * * *",
      evening: "0 20 * * *",
      bedtime: "0 22 * * *",
    },
  };

  /**
   * Parse admin text into structured catalogue definition
   */
  parse(input: AdminTextInput): ParsedCatalogue {
    // Validate input
    const validatedInput = AdminTextInputSchema.parse(input);

    const text = validatedInput.sourceText.toLowerCase();
    const metrics: MetricDefinition[] = [];
    const warnings: string[] = [];

    // Extract metrics from text
    for (const [keyword, metricDef] of Object.entries(
      this.commonKeywords.metrics
    )) {
      if (text.includes(keyword)) {
        const metric = this.parseMetric(text, metricDef, warnings);
        if (metric) {
          metrics.push(metric);
        }
      }
    }

    // Parse retention settings
    const retention = this.parseRetention(text);

    // Calculate confidence based on parsing success
    const confidence = this.calculateConfidence(text, metrics, warnings);

    const result: ParsedCatalogue = {
      metrics,
      retention,
      confidence,
      warnings,
    };

    return ParsedCatalogueSchema.parse(result);
  }

  private parseMetric(
    text: string,
    metricDef: { slug: string; displayName: string; tags: string[] },
    warnings: string[]
  ): MetricDefinition | null {
    try {
      const fields = this.parseFields(text, metricDef.slug, warnings);
      const reminderPolicy = this.parseReminderPolicy(text, warnings);

      return {
        slug: metricDef.slug,
        displayName: metricDef.displayName,
        description: this.generateDescription(text, metricDef.displayName),
        fields,
        reminderPolicy,
        analyticsTags: metricDef.tags,
      };
    } catch (error) {
      warnings.push(
        `Failed to parse metric ${metricDef.slug}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  private parseFields(
    text: string,
    metricSlug: string,
    warnings: string[]
  ): FieldDefinition[] {
    const fields: FieldDefinition[] = [];

    // Parse common fields based on metric type and text content
    if (metricSlug === "water-intake") {
      // Always include quantity for water intake
      const quantityField: FieldDefinition = {
        ...this.commonKeywords.fields.quantity,
        unit:
          this.extractUnit(text, ["ml", "cups", "glasses", "liters"]) || "ml",
      };
      fields.push(quantityField);

      // Add source if mentioned
      if (text.includes("source") || text.includes("type")) {
        fields.push(this.commonKeywords.fields.source);
      }
    } else if (metricSlug === "medication-adherence") {
      fields.push(this.commonKeywords.fields.taken);

      if (text.includes("dosage") || text.includes("dose")) {
        fields.push(this.commonKeywords.fields.dosage);
      }

      if (text.includes("time")) {
        fields.push(this.commonKeywords.fields.time);
      }
    } else if (metricSlug === "mood-tracking") {
      fields.push(this.commonKeywords.fields.mood_level);
    } else if (metricSlug === "sleep-tracking") {
      fields.push(this.commonKeywords.fields.hours);

      if (text.includes("quality")) {
        fields.push(this.commonKeywords.fields.quality);
      }
    }

    // Parse requirement specifications
    this.parseFieldRequirements(text, fields, warnings);

    if (fields.length === 0) {
      warnings.push(`No fields could be parsed for metric ${metricSlug}`);
    }

    return fields;
  }

  private parseReminderPolicy(
    text: string,
    warnings: string[]
  ): ReminderPolicy {
    let schedule = "0 8,20 * * *"; // Default: twice daily

    // Extract schedule from common patterns
    for (const [pattern, cronExpr] of Object.entries(
      this.commonKeywords.schedules
    )) {
      if (text.includes(pattern)) {
        schedule = cronExpr;
        break;
      }
    }

    const policy: ReminderPolicy = {
      schedule,
      timezone: "America/New_York", // Default timezone
    };

    // Parse escalation policy
    if (
      text.includes("escalat") ||
      text.includes("notify") ||
      text.includes("caregiver")
    ) {
      policy.escalation = {
        notifyCaregiverAfterMinutes: text.includes("30 min") ? 30 : 60,
      };
    }

    return policy;
  }

  private parseRetention(text: string): RetentionPolicy {
    const retention: RetentionPolicy = {
      journalRetentionDays: 365,
      documentRetentionDays: 180,
    };

    // Extract retention period if specified
    const retentionMatch = text.match(/keep.*?(\d+)\s*days?/i);
    if (retentionMatch) {
      retention.journalRetentionDays = parseInt(retentionMatch[1]);
    }

    const docRetentionMatch = text.match(/documents?.*?(\d+)\s*days?/i);
    if (docRetentionMatch) {
      retention.documentRetentionDays = parseInt(docRetentionMatch[1]);
    }

    return retention;
  }

  private extractUnit(
    text: string,
    possibleUnits: string[]
  ): string | undefined {
    for (const unit of possibleUnits) {
      if (text.includes(unit)) {
        return (
          this.commonKeywords.units[
            unit as keyof typeof this.commonKeywords.units
          ] || unit
        );
      }
    }
    return undefined;
  }

  private parseFieldRequirements(
    text: string,
    fields: FieldDefinition[],
    warnings: string[]
  ): void {
    // Parse required/optional specifications
    if (text.includes("required") || text.includes("mandatory")) {
      // Look for patterns like "quantity is required"
      for (const field of fields) {
        if (
          text.includes(`${field.name} is required`) ||
          text.includes(`${field.label.toLowerCase()} is required`)
        ) {
          field.required = true;
        }
      }
    }

    if (text.includes("optional")) {
      for (const field of fields) {
        if (
          text.includes(`${field.name} is optional`) ||
          text.includes(`${field.label.toLowerCase()} is optional`)
        ) {
          field.required = false;
        }
      }
    }
  }

  private generateDescription(text: string, displayName: string): string {
    // Generate a basic description from the text and display name
    if (text.includes("track")) {
      return `${displayName} tracking based on admin configuration`;
    }
    return `${displayName} monitoring and data collection`;
  }

  private calculateConfidence(
    text: string,
    metrics: MetricDefinition[],
    warnings: string[]
  ): number {
    let confidence = 0.0;

    // Base confidence from successful metric parsing
    if (metrics.length > 0) {
      confidence += 0.6;
    }

    // Bonus for clear instructions
    if (
      text.includes("track") ||
      text.includes("record") ||
      text.includes("monitor")
    ) {
      confidence += 0.1;
    }

    // Bonus for specific details
    if (text.includes("remind") || text.includes("schedule")) {
      confidence += 0.1;
    }

    // Bonus for field specifications
    if (text.includes("required") || text.includes("optional")) {
      confidence += 0.1;
    }

    // Penalty for warnings
    confidence -= warnings.length * 0.05;

    // Bonus for units and specificity
    const hasUnits = Object.keys(this.commonKeywords.units).some((unit) =>
      text.includes(unit)
    );
    if (hasUnits) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }
}

/**
 * Build a CatalogueSchemaRequest DTO from parsed catalogue data
 */
export function buildCatalogueSchemaRequest(
  parsedCatalogue: ParsedCatalogue,
  adminRuleSetId: string | null,
  sourceText: string
): CatalogueSchemaRequest {
  return CatalogueSchemaRequestSchema.parse({
    adminRuleSetId,
    parsedAt: new Date().toISOString(),
    sourceText,
    metrics: parsedCatalogue.metrics.map((metric) => ({
      slug: metric.slug,
      displayName: metric.displayName,
      description: metric.description,
      fields: metric.fields.map((field) => ({
        name: field.name,
        label: field.label,
        dataType: field.dataType,
        unit: field.unit,
        enumValues: field.enumValues,
        required: field.required,
      })),
      reminderPolicy: {
        schedule: metric.reminderPolicy.schedule,
        timezone: metric.reminderPolicy.timezone,
        escalation: metric.reminderPolicy.escalation,
      },
      analyticsTags: metric.analyticsTags,
    })),
    retention: {
      journalRetentionDays: parsedCatalogue.retention.journalRetentionDays,
      documentRetentionDays: parsedCatalogue.retention.documentRetentionDays,
    },
  });
}

/**
 * Create a default parser instance
 */
export const defaultCatalogueSchemaParser = new CatalogueSchemaParser();
