import { ZodError, ZodIssue } from "zod";
import type {
  ToolExecutionError,
  ValidationErrorDetails,
  DatabaseErrorDetails,
} from "../types/tool-execution.js";

/**
 * Format a single Zod issue into a human-readable message
 */
function formatZodIssue(issue: ZodIssue): string {
  const path = issue.path.join(".");
  const field = path || "root";

  // Use type assertions for Zod v4 compatibility
  const issueAny = issue as any;

  switch (issue.code) {
    case "invalid_type":
      return `Field '${field}' expected ${issueAny.expected}, but received ${issueAny.received}`;

    case "too_small":
      if (issueAny.type === "string") {
        return `Field '${field}' must be at least ${issueAny.minimum} characters`;
      }
      if (issueAny.type === "number") {
        return `Field '${field}' must be at least ${issueAny.minimum}`;
      }
      if (issueAny.type === "array") {
        return `Field '${field}' must contain at least ${issueAny.minimum} items`;
      }
      return `Field '${field}' is too small`;

    case "too_big":
      if (issueAny.type === "string") {
        return `Field '${field}' must be at most ${issueAny.maximum} characters`;
      }
      if (issueAny.type === "number") {
        return `Field '${field}' must be at most ${issueAny.maximum}`;
      }
      if (issueAny.type === "array") {
        return `Field '${field}' must contain at most ${issueAny.maximum} items`;
      }
      return `Field '${field}' is too big`;

    case "invalid_format":
      if (issueAny.validation === "email") {
        return `Field '${field}' must be a valid email address`;
      }
      if (issueAny.validation === "url") {
        return `Field '${field}' must be a valid URL`;
      }
      if (issueAny.validation === "datetime") {
        return `Field '${field}' must be a valid ISO 8601 datetime`;
      }
      return `Field '${field}' has invalid format`;

    case "invalid_value":
      return `Field '${field}' must be one of the allowed values. Received: ${issueAny.received}`;

    case "unrecognized_keys":
      return `Unknown fields: ${issueAny.keys?.join(", ") || ""}`;

    default:
      return `Field '${field}': validation failed`;
  }
}

/**
 * Format Zod validation error into LLM-friendly error message
 *
 * @param error - Zod validation error
 * @returns Human-readable error message with actionable guidance
 */
export function formatZodError(error: ZodError): string {
  if (error.issues.length === 1) {
    return formatZodIssue(error.issues[0]);
  }

  const messages = error.issues.map((issue, index) => {
    return `${index + 1}. ${formatZodIssue(issue)}`;
  });

  return `Multiple validation errors:\n${messages.join("\n")}`;
}

/**
 * Extract validation error details from ZodError for structured responses
 *
 * @param error - Zod validation error
 * @returns Structured error details
 */
export function extractValidationDetails(
  error: ZodError
): ValidationErrorDetails {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return {};
  }

  const field = firstIssue.path.join(".");

  return {
    field: field || undefined,
    expected:
      "expected" in firstIssue ? String(firstIssue.expected) : undefined,
    received:
      "received" in firstIssue ? String(firstIssue.received) : undefined,
    code: firstIssue.code,
  };
}

/**
 * Format database error into ToolExecutionError
 *
 * @param error - Database error from Prisma or pg
 * @returns Structured tool execution error
 */
export function formatDatabaseError(error: Error): ToolExecutionError {
  // Check for Prisma errors
  if ("code" in error) {
    const prismaError = error as any;

    // Common Prisma error codes
    switch (prismaError.code) {
      case "P2002": {
        // Unique constraint violation
        const target = prismaError.meta?.target || "unknown field";
        return {
          success: false,
          error: {
            type: "DATABASE_ERROR",
            message: `A record with this ${target} already exists`,
            details: {
              code: "P2002",
              constraint: "unique_violation",
              table: prismaError.meta?.modelName,
            } as DatabaseErrorDetails,
          },
        };
      }

      case "P2003": {
        // Foreign key constraint violation
        return {
          success: false,
          error: {
            type: "DATABASE_ERROR",
            message: "Referenced record does not exist",
            details: {
              code: "P2003",
              constraint: "foreign_key_violation",
            } as DatabaseErrorDetails,
          },
        };
      }

      case "P2025": {
        // Record not found
        return {
          success: false,
          error: {
            type: "DATABASE_ERROR",
            message: "Record not found",
            details: {
              code: "P2025",
            } as DatabaseErrorDetails,
          },
        };
      }

      default: {
        return {
          success: false,
          error: {
            type: "DATABASE_ERROR",
            message: `Database error: ${error.message}`,
            details: {
              code: prismaError.code,
            } as DatabaseErrorDetails,
          },
        };
      }
    }
  }

  // Generic database error
  return {
    success: false,
    error: {
      type: "DATABASE_ERROR",
      message: error.message || "Unknown database error",
    },
  };
}

/**
 * Create a validation error ToolExecutionError
 *
 * @param error - Zod validation error
 * @returns Structured tool execution error
 */
export function createValidationError(error: ZodError): ToolExecutionError {
  return {
    success: false,
    error: {
      type: "VALIDATION_ERROR",
      message: formatZodError(error),
      details: extractValidationDetails(error),
    },
  };
}

/**
 * Create a generic error ToolExecutionError
 *
 * @param message - Error message
 * @param details - Optional error details
 * @returns Structured tool execution error
 */
export function createGenericError(
  message: string,
  details?: Record<string, any>
): ToolExecutionError {
  return {
    success: false,
    error: {
      type: "UNKNOWN_ERROR",
      message,
      details,
    },
  };
}
