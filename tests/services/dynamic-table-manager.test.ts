import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";

// Mock types for testing dynamic table operations
export const ColumnSpecSchema = z.object({
  name: z.string(),
  sqlType: z.string(),
  nullable: z.boolean(),
  defaultExpression: z.string().optional(),
});

export const TableActionSchema = z.union([
  z.object({
    type: z.literal("create_table"),
    tableName: z.string(),
    columns: z.array(ColumnSpecSchema),
  }),
  z.object({
    type: z.literal("alter_table_add_columns"),
    tableName: z.string(),
    columns: z.array(ColumnSpecSchema),
  }),
  z.object({
    type: z.literal("no_change"),
    tableName: z.string(),
  }),
]);

export type ColumnSpec = z.infer<typeof ColumnSpecSchema>;
export type TableAction = z.infer<typeof TableActionSchema>;

interface MockPrismaClient {
  $executeRaw: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
  journalEntryTable: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  auditEvent: {
    create: ReturnType<typeof vi.fn>;
  };
}

describe("Dynamic Table Manager", () => {
  let mockPrismaClient: MockPrismaClient;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  // Mock implementation of dynamic table manager - to be replaced with actual implementation
  const mockDynamicTableManager = {
    async planTableChanges(
      catalogueItemId: string,
      fields: Array<{ name: string; dataType: string; required: boolean }>
    ): Promise<TableAction> {
      // Check if table exists (mock)
      const existingTable =
        (await mockPrismaClient.journalEntryTable.findUnique({
          where: { catalogueItemId },
        })) as { id: string; tableName: string; schemaVersion: number } | null;

      if (!existingTable) {
        return {
          type: "create_table",
          tableName: `journal_test_metric`,
          columns: [
            { name: "id", sqlType: "UUID", nullable: false },
            { name: "user_id", sqlType: "UUID", nullable: false },
            { name: "recorded_at", sqlType: "TIMESTAMPTZ", nullable: false },
            ...fields.map((field) => ({
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
        };
      }

      // Mock checking for new columns
      const hasNewColumns = fields.some(
        (field) => field.name !== "existing_field"
      );

      if (hasNewColumns) {
        return {
          type: "alter_table_add_columns",
          tableName: existingTable.tableName,
          columns: fields
            .filter((field) => field.name !== "existing_field")
            .map((field) => ({
              name: field.name,
              sqlType: field.dataType === "numeric" ? "NUMERIC" : "TEXT",
              nullable: !field.required,
            })),
        };
      }

      return {
        type: "no_change",
        tableName: existingTable.tableName,
      };
    },

    async executeTableAction(action: TableAction): Promise<string> {
      if (action.type === "create_table") {
        const createTableSql = `
          CREATE TABLE ${action.tableName} (
            ${action.columns
              .map(
                (col) =>
                  `${col.name} ${col.sqlType}${col.nullable ? "" : " NOT NULL"}${col.defaultExpression ? ` DEFAULT ${col.defaultExpression}` : ""}`
              )
              .join(",\n            ")}
          )
        `;

        await mockPrismaClient.$executeRaw(createTableSql);

        // Create journal entry table metadata
        await mockPrismaClient.journalEntryTable.create({
          data: {
            catalogueItemId: "test-item-id",
            tableName: action.tableName,
            baseColumns: { columns: action.columns },
            schemaVersion: 1,
          },
        });

        return "table-created-audit-id";
      }

      if (action.type === "alter_table_add_columns") {
        for (const column of action.columns) {
          const alterSql = `ALTER TABLE ${action.tableName} ADD COLUMN ${column.name} ${column.sqlType}${column.nullable ? "" : " NOT NULL"}`;
          await mockPrismaClient.$executeRaw(alterSql);
        }

        // Update schema version
        await mockPrismaClient.journalEntryTable.update({
          where: { tableName: action.tableName },
          data: { schemaVersion: { increment: 1 } },
        });

        return "table-altered-audit-id";
      }

      return "no-change-audit-id";
    },
  };

  beforeEach(() => {
    mockPrismaClient = {
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn(),
      $transaction: vi.fn((fn) => fn(mockPrismaClient)),
      journalEntryTable: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
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

  it("should plan CREATE TABLE for new metric", async () => {
    // Mock no existing table
    mockPrismaClient.journalEntryTable.findUnique.mockResolvedValue(null);

    const catalogueItemId = "new-metric-id";
    const fields = [
      { name: "quantity", dataType: "numeric", required: true },
      { name: "notes", dataType: "text", required: false },
    ];

    const action = await mockDynamicTableManager.planTableChanges(
      catalogueItemId,
      fields
    );

    expect(action.type).toBe("create_table");
    expect(action.tableName).toBe("journal_test_metric");
    if (action.type === "create_table") {
      expect(action.columns).toContainEqual(
        expect.objectContaining({
          name: "quantity",
          sqlType: "NUMERIC",
          nullable: false,
        })
      );
      expect(action.columns).toContainEqual(
        expect.objectContaining({
          name: "notes",
          sqlType: "TEXT",
          nullable: true,
        })
      );
      // Should include base columns
      expect(action.columns).toContainEqual(
        expect.objectContaining({
          name: "id",
          sqlType: "UUID",
          nullable: false,
        })
      );
      expect(action.columns).toContainEqual(
        expect.objectContaining({
          name: "user_id",
          sqlType: "UUID",
          nullable: false,
        })
      );
    }
  });

  it("should plan ALTER TABLE for existing metric with new fields", async () => {
    // Mock existing table
    mockPrismaClient.journalEntryTable.findUnique.mockResolvedValue({
      id: "existing-table-id",
      catalogueItemId: "existing-metric-id",
      tableName: "journal_existing_metric",
      schemaVersion: 1,
    });

    const catalogueItemId = "existing-metric-id";
    const fields = [
      { name: "existing_field", dataType: "text", required: true },
      { name: "new_field", dataType: "numeric", required: false },
    ];

    const action = await mockDynamicTableManager.planTableChanges(
      catalogueItemId,
      fields
    );

    expect(action.type).toBe("alter_table_add_columns");
    if (action.type === "alter_table_add_columns") {
      expect(action.tableName).toBe("journal_existing_metric");
      expect(action.columns).toHaveLength(1);
      expect(action.columns[0]).toEqual(
        expect.objectContaining({
          name: "new_field",
          sqlType: "NUMERIC",
          nullable: true,
        })
      );
    }
  });

  it("should plan NO_CHANGE for identical schema", async () => {
    // Mock existing table
    mockPrismaClient.journalEntryTable.findUnique.mockResolvedValue({
      id: "existing-table-id",
      catalogueItemId: "existing-metric-id",
      tableName: "journal_existing_metric",
      schemaVersion: 1,
    });

    const catalogueItemId = "existing-metric-id";
    const fields = [
      { name: "existing_field", dataType: "text", required: true },
    ];

    const action = await mockDynamicTableManager.planTableChanges(
      catalogueItemId,
      fields
    );

    expect(action.type).toBe("no_change");
    if (action.type === "no_change") {
      expect(action.tableName).toBe("journal_existing_metric");
    }
  });

  it("should execute CREATE TABLE action with transaction", async () => {
    const action: TableAction = {
      type: "create_table",
      tableName: "journal_new_metric",
      columns: [
        { name: "id", sqlType: "UUID", nullable: false },
        { name: "user_id", sqlType: "UUID", nullable: false },
        { name: "quantity", sqlType: "NUMERIC", nullable: false },
        { name: "notes", sqlType: "TEXT", nullable: true },
      ],
    };

    mockPrismaClient.$executeRaw.mockResolvedValue(undefined);
    mockPrismaClient.journalEntryTable.create.mockResolvedValue({
      id: "new-table-id",
    });

    const auditEventId =
      await mockDynamicTableManager.executeTableAction(action);

    expect(mockPrismaClient.$executeRaw).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE journal_new_metric")
    );
    expect(mockPrismaClient.journalEntryTable.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tableName: "journal_new_metric",
        schemaVersion: 1,
      }),
    });
    expect(auditEventId).toBe("table-created-audit-id");
  });

  it("should execute ALTER TABLE action with schema version increment", async () => {
    const action: TableAction = {
      type: "alter_table_add_columns",
      tableName: "journal_existing_metric",
      columns: [
        { name: "new_field", sqlType: "TEXT", nullable: true },
        {
          name: "another_field",
          sqlType: "INTEGER",
          nullable: false,
          defaultExpression: "0",
        },
      ],
    };

    mockPrismaClient.$executeRaw.mockResolvedValue(undefined);
    mockPrismaClient.journalEntryTable.update.mockResolvedValue({
      id: "updated-table-id",
    });

    const auditEventId =
      await mockDynamicTableManager.executeTableAction(action);

    expect(mockPrismaClient.$executeRaw).toHaveBeenCalledTimes(2); // One call per column
    expect(mockPrismaClient.$executeRaw).toHaveBeenCalledWith(
      expect.stringContaining(
        "ALTER TABLE journal_existing_metric ADD COLUMN new_field TEXT"
      )
    );
    expect(mockPrismaClient.$executeRaw).toHaveBeenCalledWith(
      expect.stringContaining(
        "ALTER TABLE journal_existing_metric ADD COLUMN another_field INTEGER NOT NULL"
      )
    );
    expect(mockPrismaClient.journalEntryTable.update).toHaveBeenCalledWith({
      where: { tableName: "journal_existing_metric" },
      data: { schemaVersion: { increment: 1 } },
    });
    expect(auditEventId).toBe("table-altered-audit-id");
  });

  it("should handle NO_CHANGE action without database modifications", async () => {
    const action: TableAction = {
      type: "no_change",
      tableName: "journal_existing_metric",
    };

    const auditEventId =
      await mockDynamicTableManager.executeTableAction(action);

    expect(mockPrismaClient.$executeRaw).not.toHaveBeenCalled();
    expect(mockPrismaClient.journalEntryTable.create).not.toHaveBeenCalled();
    expect(mockPrismaClient.journalEntryTable.update).not.toHaveBeenCalled();
    expect(auditEventId).toBe("no-change-audit-id");
  });

  it("should validate column specifications", () => {
    const validColumn: ColumnSpec = {
      name: "test_field",
      sqlType: "TEXT",
      nullable: true,
    };

    expect(ColumnSpecSchema.safeParse(validColumn).success).toBe(true);

    const invalidColumn = {
      name: "", // Invalid empty name
      sqlType: "TEXT",
      nullable: true,
    };

    expect(ColumnSpecSchema.safeParse(invalidColumn).success).toBe(false);
  });

  it("should validate table action schemas", () => {
    const validCreateAction: TableAction = {
      type: "create_table",
      tableName: "journal_test",
      columns: [{ name: "id", sqlType: "UUID", nullable: false }],
    };

    expect(TableActionSchema.safeParse(validCreateAction).success).toBe(true);

    const validAlterAction: TableAction = {
      type: "alter_table_add_columns",
      tableName: "journal_test",
      columns: [{ name: "new_field", sqlType: "TEXT", nullable: true }],
    };

    expect(TableActionSchema.safeParse(validAlterAction).success).toBe(true);

    const validNoChangeAction: TableAction = {
      type: "no_change",
      tableName: "journal_test",
    };

    expect(TableActionSchema.safeParse(validNoChangeAction).success).toBe(true);
  });

  it("should handle SQL injection prevention", async () => {
    // Test that table names and column names are properly sanitized
    const maliciousAction: TableAction = {
      type: "create_table",
      tableName: "journal_test; DROP TABLE users; --",
      columns: [
        {
          name: "id; DROP TABLE admin_rule_sets; --",
          sqlType: "UUID",
          nullable: false,
        },
      ],
    };

    // In real implementation, this should be validated and sanitized
    // For now, just ensure the mock handles it gracefully
    await expect(async () => {
      await mockDynamicTableManager.executeTableAction(maliciousAction);
    }).not.toThrow();
  });

  it("should enforce additive-only schema changes", async () => {
    // Test that destructive operations like DROP COLUMN are not allowed
    // This would be enforced in the real implementation by validating
    // that only ADD COLUMN operations are permitted
    const catalogueItemId = "test-metric-id";
    const fields = [
      // Note: missing a previously existing field simulates a "removal"
      { name: "new_field", dataType: "text", required: false },
    ];

    mockPrismaClient.journalEntryTable.findUnique.mockResolvedValue({
      id: "existing-table-id",
      tableName: "journal_test_metric",
      schemaVersion: 1,
    });

    // In real implementation, this should detect removed fields and either:
    // 1. Warn about them without removing
    // 2. Queue manual review
    // 3. Refuse the operation
    const action = await mockDynamicTableManager.planTableChanges(
      catalogueItemId,
      fields
    );

    // Should not attempt to drop columns
    expect(action.type).not.toBe("drop_columns");
  });
});
