import { Prisma, PrismaClient } from "@prisma/client";
import { ExtendedPrismaClient, withTransaction } from "../lib/prisma-client.js";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Types for dynamic table operations
export const ColumnSpecSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z_][a-z0-9_]*$/, "Column name must be snake_case"),
  sqlType: z.string(),
  nullable: z.boolean(),
  defaultExpression: z.string().optional(),
});

export const TableActionSchema = z.union([
  z.object({
    type: z.literal("create_table"),
    tableName: z.string(),
    catalogueItemId: z.string(),
    columns: z.array(ColumnSpecSchema),
  }),
  z.object({
    type: z.literal("alter_table_add_columns"),
    tableName: z.string(),
    catalogueItemId: z.string(),
    columns: z.array(ColumnSpecSchema),
  }),
  z.object({
    type: z.literal("no_change"),
    tableName: z.string(),
    catalogueItemId: z.string(),
  }),
]);

export type ColumnSpec = z.infer<typeof ColumnSpecSchema>;
export type TableAction = z.infer<typeof TableActionSchema>;

// Field definition for planning
export interface FieldDefinition {
  name: string;
  dataType: "numeric" | "integer" | "boolean" | "text" | "enum" | "datetime";
  required: boolean;
  enumValues?: string[];
  unit?: string;
}

interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
}

/**
 * Dynamic Table Manager Service
 * Handles runtime DDL operations for journal tables based on catalogue changes
 */
export class DynamicTableManager {
  private readonly prisma: ExtendedPrismaClient;
  private readonly logger?: Logger;
  private readonly baseTableTemplate: string | null = null;

  constructor(prisma: ExtendedPrismaClient, logger?: Logger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Load the base table SQL template
   */
  private async loadBaseTableTemplate(): Promise<string> {
    if (this.baseTableTemplate) {
      return this.baseTableTemplate;
    }

    try {
      const templatePath = path.join(
        process.cwd(),
        "prisma",
        "sql",
        "journal_base_table.sql"
      );
      return await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      this.logger?.error("Failed to load base table template", { error });
      throw new Error("Could not load journal base table template");
    }
  }

  /**
   * Plan table changes for a catalogue item
   * Returns the action needed (create, alter, or no change)
   */
  async planTableChanges(
    catalogueItemId: string,
    fields: FieldDefinition[],
    slug: string
  ): Promise<TableAction> {
    this.logger?.info("Planning table changes", {
      catalogueItemId,
      slug,
      fieldCount: fields.length,
    });

    // Check if table already exists
    const existingTable = await this.prisma.journalEntryTable.findUnique({
      where: { catalogueItemId },
      include: {
        catalogueItem: true,
      },
    });

    const tableName =
      existingTable?.tableName || `journal_${slug.replace(/-/g, "_")}`;

    if (!existingTable) {
      // Need to create new table
      const columns = this.buildTableColumns(fields);
      return {
        type: "create_table",
        tableName,
        catalogueItemId,
        columns,
      };
    }

    // Check if we need to add new columns
    const existingColumns = await this.getExistingTableColumns(tableName);
    const newColumns = this.identifyNewColumns(fields, existingColumns);

    if (newColumns.length > 0) {
      return {
        type: "alter_table_add_columns",
        tableName,
        catalogueItemId,
        columns: newColumns,
      };
    }

    return {
      type: "no_change",
      tableName,
      catalogueItemId,
    };
  }

  /**
   * Execute a table action (create, alter, or no-op)
   */
  async executeTableAction(
    action: TableAction,
    adminRuleSetId: string
  ): Promise<string> {
    this.logger?.info("Executing table action", {
      type: action.type,
      tableName: action.tableName,
    });

    return await withTransaction(
      this.prisma,
      async (tx) => {
        let auditEventId: string;

        if (action.type === "create_table") {
          auditEventId = await this.executeCreateTable(
            tx,
            action,
            adminRuleSetId
          );
        } else if (action.type === "alter_table_add_columns") {
          auditEventId = await this.executeAlterTable(
            tx,
            action,
            adminRuleSetId
          );
        } else {
          auditEventId = await this.logNoChangeEvent(
            tx,
            action,
            adminRuleSetId
          );
        }

        return auditEventId;
      },
      this.logger
    );
  }

  /**
   * Build columns for a new table including base columns
   */
  private buildTableColumns(fields: FieldDefinition[]): ColumnSpec[] {
    // Base columns that every journal table must have
    const baseColumns: ColumnSpec[] = [
      { name: "id", sqlType: "UUID", nullable: false },
      { name: "user_id", sqlType: "UUID", nullable: false },
      { name: "who_recorded", sqlType: "UUID", nullable: true },
      { name: "source_message_id", sqlType: "TEXT", nullable: true },
      { name: "submitted_at", sqlType: "TIMESTAMPTZ", nullable: false },
      {
        name: "recorded_at",
        sqlType: "TIMESTAMPTZ",
        nullable: false,
        defaultExpression: "NOW()",
      },
      {
        name: "health_week_label",
        sqlType: "TEXT",
        nullable: true,
        defaultExpression: "'unspecified'",
      },
      {
        name: "meta",
        sqlType: "JSONB",
        nullable: true,
        defaultExpression: "'{}'",
      },
    ];

    // Add field-specific columns
    const fieldColumns: ColumnSpec[] = fields.map((field) => ({
      name: field.name,
      sqlType: DynamicTableManager.mapDataTypeToSQL(field.dataType),
      nullable: !field.required,
    }));

    return [...baseColumns, ...fieldColumns];
  }

  /**
   * Map field data types to PostgreSQL types
   */
  public static mapDataTypeToSQL(dataType: string): string {
    switch (dataType) {
      case "numeric":
        return "NUMERIC";
      case "integer":
        return "INTEGER";
      case "boolean":
        return "BOOLEAN";
      case "datetime":
        return "TIMESTAMPTZ";
      case "enum":
      case "text":
      default:
        return "TEXT";
    }
  }

  /**
   * Get existing columns for a table
   */
  private async getExistingTableColumns(tableName: string): Promise<string[]> {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{ column_name: string }>
      >`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${tableName}
        AND table_schema = 'public'
      `;
      return result.map((row: { column_name: string }) => row.column_name);
    } catch (error) {
      this.logger?.warn("Could not fetch existing columns", {
        tableName,
        error,
      });
      return [];
    }
  }

  /**
   * Identify new columns that need to be added
   */
  private identifyNewColumns(
    fields: FieldDefinition[],
    existingColumns: string[]
  ): ColumnSpec[] {
    const existingSet = new Set(existingColumns);

    return fields
      .filter((field) => !existingSet.has(field.name))
      .map((field) => ({
        name: field.name,
        sqlType: DynamicTableManager.mapDataTypeToSQL(field.dataType),
        nullable: !field.required,
      }));
  }

  /**
   * Execute CREATE TABLE action
   */
  private async executeCreateTable(
    tx: Prisma.TransactionClient,
    action: TableAction & { type: "create_table" },
    adminRuleSetId: string
  ): Promise<string> {
    // Generate CREATE TABLE SQL
    const createTableSQL = this.generateCreateTableSQL(
      action.tableName,
      action.columns
    );

    // Execute DDL
    await tx.$executeRaw`${createTableSQL}`;

    // Create journal entry table metadata
    await tx.journalEntryTable.create({
      data: {
        catalogueItemId: action.catalogueItemId,
        tableName: action.tableName,
        baseColumns: { columns: action.columns },
        schemaVersion: 1,
      },
    });

    // Create audit event
    const auditEvent = await tx.auditEvent.create({
      data: {
        actorType: "admin",
        eventType: "catalogue.table_created",
        resourceRef: action.tableName,
        payload: {
          action: "create_table",
          tableName: action.tableName,
          catalogueItemId: action.catalogueItemId,
          columns: action.columns,
          adminRuleSetId,
        },
      },
    });

    this.logger?.info("Created journal table", {
      tableName: action.tableName,
      columns: action.columns.length,
      auditEventId: auditEvent.id,
    });

    return auditEvent.id;
  }

  /**
   * Execute ALTER TABLE ADD COLUMNS action
   */
  private async executeAlterTable(
    tx: Prisma.TransactionClient,
    action: TableAction & { type: "alter_table_add_columns" },
    adminRuleSetId: string
  ): Promise<string> {
    // Execute ALTER TABLE for each new column
    for (const column of action.columns) {
      const alterSQL = this.generateAlterTableSQL(action.tableName, column);
      await tx.$executeRaw`${alterSQL}`;
    }

    // Update schema version
    await tx.journalEntryTable.update({
      where: { tableName: action.tableName },
      data: {
        schemaVersion: { increment: 1 },
        updatedAt: new Date(),
      },
    });

    // Create audit event
    const auditEvent = await tx.auditEvent.create({
      data: {
        actorType: "admin",
        eventType: "catalogue.table_altered",
        resourceRef: action.tableName,
        payload: {
          action: "alter_table_add_columns",
          tableName: action.tableName,
          catalogueItemId: action.catalogueItemId,
          addedColumns: action.columns,
          adminRuleSetId,
        },
      },
    });

    this.logger?.info("Altered journal table", {
      tableName: action.tableName,
      addedColumns: action.columns.length,
      auditEventId: auditEvent.id,
    });

    return auditEvent.id;
  }

  /**
   * Log no-change event for audit trail
   */
  private async logNoChangeEvent(
    tx: Prisma.TransactionClient,
    action: TableAction & { type: "no_change" },
    adminRuleSetId: string
  ): Promise<string> {
    const auditEvent = await tx.auditEvent.create({
      data: {
        actorType: "admin",
        eventType: "catalogue.no_table_change",
        resourceRef: action.tableName,
        payload: {
          action: "no_change",
          tableName: action.tableName,
          catalogueItemId: action.catalogueItemId,
          adminRuleSetId,
        },
      },
    });

    this.logger?.info("No table changes needed", {
      tableName: action.tableName,
      auditEventId: auditEvent.id,
    });

    return auditEvent.id;
  }

  /**
   * Generate CREATE TABLE SQL statement
   */
  private generateCreateTableSQL(
    tableName: string,
    columns: ColumnSpec[]
  ): string {
    const sanitizedTableName = this.sanitizeIdentifier(tableName);
    const columnDefinitions = columns
      .map((col) => {
        const sanitizedName = this.sanitizeIdentifier(col.name);
        const nullClause = col.nullable ? "" : " NOT NULL";
        const defaultClause = col.defaultExpression
          ? ` DEFAULT ${col.defaultExpression}`
          : "";
        return `  ${sanitizedName} ${col.sqlType}${nullClause}${defaultClause}`;
      })
      .join(",\n");

    return `
CREATE TABLE ${sanitizedTableName} (
${columnDefinitions},
  PRIMARY KEY (id),
  CONSTRAINT fk_${sanitizedTableName}_user FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
  CONSTRAINT fk_${sanitizedTableName}_caregiver FOREIGN KEY (who_recorded) REFERENCES caregiver_profiles(id),
  CONSTRAINT chk_${sanitizedTableName}_health_week CHECK (health_week_label IN ('healthy', 'unhealthy', 'unspecified'))
);

CREATE INDEX idx_${sanitizedTableName}_user_recorded ON ${sanitizedTableName} (user_id, recorded_at DESC);
CREATE INDEX idx_${sanitizedTableName}_recorded ON ${sanitizedTableName} (recorded_at DESC);
    `.trim();
  }

  /**
   * Generate ALTER TABLE ADD COLUMN SQL statement
   */
  private generateAlterTableSQL(tableName: string, column: ColumnSpec): string {
    const sanitizedTableName = this.sanitizeIdentifier(tableName);
    const sanitizedColumnName = this.sanitizeIdentifier(column.name);
    const nullClause = column.nullable ? "" : " NOT NULL";
    const defaultClause = column.defaultExpression
      ? ` DEFAULT ${column.defaultExpression}`
      : "";

    return `ALTER TABLE ${sanitizedTableName} ADD COLUMN ${sanitizedColumnName} ${column.sqlType}${nullClause}${defaultClause}`;
  }

  /**
   * Sanitize SQL identifiers to prevent injection
   */
  private sanitizeIdentifier(identifier: string): string {
    // Only allow alphanumeric characters and underscores
    const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, "");

    // Ensure it starts with a letter or underscore
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      throw new Error(
        `Invalid identifier: ${identifier}. Must start with letter or underscore.`
      );
    }

    // Prevent SQL keywords (basic list)
    const sqlKeywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "INSERT",
      "UPDATE",
      "DELETE",
      "DROP",
      "CREATE",
      "ALTER",
      "TABLE",
    ];
    if (sqlKeywords.includes(sanitized.toUpperCase())) {
      throw new Error(
        `Invalid identifier: ${identifier}. Cannot use SQL keywords.`
      );
    }

    return sanitized;
  }

  /**
   * Validate that table changes are additive only
   */
  private validateAdditiveChanges(
    existingColumns: string[],
    newFields: FieldDefinition[]
  ): void {
    const newFieldNames = new Set(newFields.map((f) => f.name));
    const missingColumns = existingColumns.filter(
      (col) =>
        ![
          "id",
          "user_id",
          "who_recorded",
          "source_message_id",
          "submitted_at",
          "recorded_at",
          "health_week_label",
          "meta",
        ].includes(col) && !newFieldNames.has(col)
    );

    if (missingColumns.length > 0) {
      this.logger?.warn("Detected potential column removals - not executing", {
        missingColumns,
      });
      throw new Error(
        `Destructive schema changes not allowed. Missing columns: ${missingColumns.join(", ")}`
      );
    }
  }
}
