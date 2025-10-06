import { getPrismaClient } from "../lib/prisma-client.js";
import { applyColumnMappings } from "../lib/parsing/column-mapper.js";
import {
  formatDatabaseError,
  createGenericError,
} from "../lib/parsing/error-formatter.js";
import type { ToolExecutionResult } from "../lib/types/tool-execution.js";
import { Prisma } from "@prisma/client";

/**
 * Whitelist of allowed table names from Prisma schema
 * This prevents SQL injection via table names
 */
const ALLOWED_TABLES = new Set([
  "admin_rule_sets",
  "admin_rule_set_versions",
  "metric_definitions",
  "journal_entries",
  "reminder_rules",
  "reminder_escalations",
  "audit_events",
  "documents",
  "embeddings",
  // Add dynamic tables as they are created
  // This will be populated at runtime from Prisma schema introspection
]);

/**
 * Validate that table name is in the whitelist
 *
 * @param tableName - Table name to validate
 * @returns true if valid
 * @throws Error if table name is not allowed
 */
function validateTableName(tableName: string): boolean {
  if (!ALLOWED_TABLES.has(tableName)) {
    throw new Error(
      `Table '${tableName}' is not in the allowed tables whitelist`
    );
  }
  return true;
}

/**
 * Execute tool to insert data into a table
 *
 * @param tableName - Physical table name (must be in whitelist)
 * @param fieldValues - Record of field names to values
 * @param columnMappings - Optional mapping from logical to physical column names
 * @returns Promise<ToolExecutionResult>
 */
export async function executeTool(
  tableName: string,
  fieldValues: Record<string, any>,
  columnMappings?: Record<string, string>
): Promise<ToolExecutionResult> {
  const prisma = getPrismaClient();

  try {
    // Validate table name against whitelist
    validateTableName(tableName);

    // Apply column mappings
    const mappedFields = applyColumnMappings(fieldValues, columnMappings);

    // Build parameterized query
    const columns = Object.keys(mappedFields);
    const values = Object.values(mappedFields);

    // Create placeholders ($1, $2, etc.)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const columnList = columns.map((col) => `"${col}"`).join(", ");

    // SQL injection safe query with parameterized values
    const query = `
      INSERT INTO "${tableName}" (${columnList})
      VALUES (${placeholders})
      RETURNING id
    `;

    // Execute raw query with parameters
    const result = await prisma.$queryRawUnsafe<{ id: string }[]>(
      query,
      ...values
    );

    const insertedId = result[0]?.id;

    // Log to audit trail
    await logAuditEvent(tableName, "insert", insertedId, mappedFields);

    return {
      success: true,
      data: {
        id: insertedId,
        rowCount: 1,
        message: `Successfully inserted record into ${tableName}${insertedId ? ` with ID ${insertedId}` : ""}`,
      },
    };
  } catch (error) {
    console.error(`Tool execution error for table ${tableName}:`, error);

    if (error instanceof Error) {
      // Check if it's a database error
      if ("code" in error) {
        return formatDatabaseError(error);
      }

      // Generic error
      return createGenericError(error.message);
    }

    return createGenericError("Unknown error during tool execution");
  }
}

/**
 * Log tool execution to audit trail
 *
 * @param tableName - Table affected
 * @param action - Action performed
 * @param recordId - ID of affected record
 * @param data - Data that was inserted/updated
 */
async function logAuditEvent(
  tableName: string,
  action: string,
  recordId: string | undefined,
  data: Record<string, any>
): Promise<void> {
  const prisma = getPrismaClient();

  try {
    await prisma.auditEvent.create({
      data: {
        eventType: "tool_execution",
        actorType: "system",
        resourceRef: `${tableName}${recordId ? `:${recordId}` : ""}`,
        payload: {
          action,
          tableName,
          data,
        } as Prisma.JsonObject,
        occurredAt: new Date(),
      },
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error("Failed to log audit event:", error);
  }
}

/**
 * Add a table to the whitelist (called when dynamic tables are created)
 *
 * @param tableName - Table name to add
 */
export function addAllowedTable(tableName: string): void {
  ALLOWED_TABLES.add(tableName);
}

/**
 * Get list of allowed tables
 *
 * @returns Array of allowed table names
 */
export function getAllowedTables(): string[] {
  return Array.from(ALLOWED_TABLES);
}
