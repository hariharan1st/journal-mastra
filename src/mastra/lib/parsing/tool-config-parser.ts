import { ZodError } from "zod";
import {
  ToolConfigurationSchema,
  ToolConfiguration,
} from "./tool-config-schema.js";

/**
 * Custom error class for configuration parsing errors
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly zodError?: ZodError
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Format Zod validation errors into human-readable messages
 */
function formatZodError(error: ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join(".");
    const message = issue.message;
    return `  - ${path}: ${message}`;
  });

  return `Configuration validation failed:\n${issues.join("\n")}`;
}

/**
 * Load and validate tool configuration from JSON string or object
 *
 * @param input - JSON string or configuration object
 * @returns Validated ToolConfiguration
 * @throws ConfigError if validation fails
 */
export function loadToolConfiguration(
  input: string | object
): ToolConfiguration {
  let parsed: unknown;

  // Parse JSON string if needed
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      throw new ConfigError(
        `Failed to parse configuration JSON: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  } else {
    parsed = input;
  }

  // Validate against schema
  try {
    return ToolConfigurationSchema.parse(parsed);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConfigError(formatZodError(error), error);
    }
    throw new ConfigError(
      `Unexpected validation error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Safely load configuration without throwing errors
 *
 * @param input - JSON string or configuration object
 * @returns Success object with config or error object with details
 */
export function safeLoadToolConfiguration(
  input: string | object
):
  | { success: true; config: ToolConfiguration }
  | { success: false; error: string; zodError?: ZodError } {
  try {
    const config = loadToolConfiguration(input);
    return { success: true, config };
  } catch (error) {
    if (error instanceof ConfigError) {
      return {
        success: false,
        error: error.message,
        zodError: error.zodError,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown configuration error",
    };
  }
}
