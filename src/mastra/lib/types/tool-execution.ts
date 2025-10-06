/**
 * Tool execution result types for dynamic configuration-driven tools
 */

// Success response from tool execution
export interface ToolExecutionSuccess {
  success: true;
  data: {
    id?: string; // UUID of inserted row (if table has id column)
    rowCount: number; // Number of rows affected
    message: string; // Human-readable success message
  };
}

// Error types for tool execution failures
export type ToolExecutionErrorType =
  | "VALIDATION_ERROR" // Input validation failed
  | "DATABASE_ERROR" // Database operation failed
  | "CONFIG_ERROR" // Configuration error
  | "UNKNOWN_ERROR"; // Unexpected error

// Error details for validation failures
export interface ValidationErrorDetails {
  field?: string; // Field that caused error
  expected?: string; // Expected value/type
  received?: string; // Actual value received
  code?: string; // Zod error code
}

// Error details for database failures
export interface DatabaseErrorDetails {
  code?: string; // Database error code
  constraint?: string; // Violated constraint name
  table?: string; // Table name
}

// Generic error details
export type ErrorDetails =
  | ValidationErrorDetails
  | DatabaseErrorDetails
  | Record<string, any>;

// Error response from tool execution
export interface ToolExecutionError {
  success: false;
  error: {
    type: ToolExecutionErrorType;
    message: string; // LLM-friendly error description
    details?: ErrorDetails;
  };
}

// Union type for all tool execution results
export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionError;

// Type guard for success results
export function isToolExecutionSuccess(
  result: ToolExecutionResult
): result is ToolExecutionSuccess {
  return result.success === true;
}

// Type guard for error results
export function isToolExecutionError(
  result: ToolExecutionResult
): result is ToolExecutionError {
  return result.success === false;
}
