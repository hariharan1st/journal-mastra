import { createTool } from "@mastra/core/tools";
import { ZodTypeAny } from "zod";
import type {
  ToolConfiguration,
  TableConfig,
} from "../lib/parsing/tool-config-schema.js";
import { buildTableInputSchema } from "../lib/parsing/field-type-mapper.js";
import { executeTool, addAllowedTable } from "./tool-executor.js";
import { createValidationError } from "../lib/parsing/error-formatter.js";
import { ZodError } from "zod";

/**
 * Cache for generated input schemas
 */
const schemaCache = new Map<string, ReturnType<typeof buildTableInputSchema>>();

/**
 * Service for generating dynamic Mastra tools from configuration
 */
export class DynamicToolGenerator {
  /**
   * Generate Mastra tools from tool configuration
   *
   * @param config - Tool configuration
   * @returns Array of Mastra tools ready for agent registration
   */
  async generateTools(config: ToolConfiguration): Promise<any[]> {
    const tools: any[] = [];
    const seenToolIds = new Set<string>();

    for (const tableConfig of config.tables) {
      // Ensure unique tool IDs
      if (seenToolIds.has(tableConfig.toolId)) {
        throw new Error(
          `Duplicate tool ID '${tableConfig.toolId}' in configuration`
        );
      }
      seenToolIds.add(tableConfig.toolId);

      // Generate tool for this table
      const tool = this.generateToolForTable(tableConfig);
      tools.push(tool);

      // Add table to executor whitelist
      addAllowedTable(tableConfig.tableName);
    }

    return tools;
  }

  /**
   * Generate a single Mastra tool for a table configuration
   *
   * @param tableConfig - Table configuration
   * @returns Mastra tool
   */
  private generateToolForTable(tableConfig: TableConfig): any {
    // Get or build input schema
    const inputSchema = this.getInputSchema(tableConfig);

    // Create Mastra tool
    const tool = createTool({
      id: tableConfig.toolId,
      description: `${tableConfig.displayName}: ${tableConfig.description}`,
      inputSchema,
      execute: async (input: Record<string, any>) => {
        try {
          // Validate input against schema
          const validatedInput = inputSchema.parse(input);

          // Execute tool
          const result = await executeTool(
            tableConfig.tableName,
            validatedInput,
            tableConfig.columnMappings
          );

          return result;
        } catch (error) {
          // Handle validation errors
          if (error instanceof ZodError) {
            return createValidationError(error);
          }

          // Handle other errors
          console.error("Tool execution error:", error);
          return {
            success: false,
            error: {
              type: "UNKNOWN_ERROR" as const,
              message: error instanceof Error ? error.message : "Unknown error",
            },
          };
        }
      },
    });

    return tool;
  }

  /**
   * Get input schema from cache or build new one
   *
   * @param tableConfig - Table configuration
   * @returns Zod object schema for table input
   */
  private getInputSchema(
    tableConfig: TableConfig
  ): ReturnType<typeof buildTableInputSchema> {
    const cacheKey = tableConfig.toolId;

    if (schemaCache.has(cacheKey)) {
      return schemaCache.get(cacheKey)!;
    }

    const schema = buildTableInputSchema(tableConfig.fields);
    schemaCache.set(cacheKey, schema);

    return schema;
  }

  /**
   * Clear schema cache (useful for testing)
   */
  clearCache(): void {
    schemaCache.clear();
  }
}

/**
 * Create a new DynamicToolGenerator instance
 *
 * @returns DynamicToolGenerator instance
 */
export function createDynamicToolGenerator(): DynamicToolGenerator {
  return new DynamicToolGenerator();
}
