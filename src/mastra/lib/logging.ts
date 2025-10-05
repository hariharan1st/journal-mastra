/**
 * Logging Configuration for Journal Mastra
 *
 * Provides structured logging for DDL operations, service interactions,
 * and performance monitoring across the journaling system.
 *
 * Key Features:
 * - Performance metrics for DDL operations
 * - Tool execution telemetry
 * - Service-level monitoring
 * - Compliance and audit logging
 */

// Simple console-based logger for development
// In production, this should be replaced with proper structured logging
const logger = {
  info: (data: any, message?: string) => {
    console.log(message || JSON.stringify(data, null, 2), data);
  },
  warn: (data: any, message?: string) => {
    console.warn(message || JSON.stringify(data, null, 2), data);
  },
  error: (data: any, message?: string) => {
    console.error(message || JSON.stringify(data, null, 2), data);
  },
  debug: (data: any, message?: string) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(message || JSON.stringify(data, null, 2), data);
    }
  },
};

/**
 * Performance logging for DDL operations
 */
export const logDDLPerformance = (
  operation: string,
  tableName: string,
  executionTimeMs: number,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "dynamic-table-manager",
    operation,
    tableName,
    executionTimeMs,
    performanceAlert: executionTimeMs > 5000, // Alert if > 5 seconds
    ...metadata,
  };

  if (executionTimeMs > 10000) {
    logger.warn(logData, `Slow DDL operation: ${operation} on ${tableName}`);
  } else {
    logger.info(
      logData,
      `DDL operation completed: ${operation} on ${tableName}`
    );
  }
};

/**
 * Tool execution telemetry
 */
export const logToolExecution = (
  toolName: string,
  executionTimeMs: number,
  success: boolean,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "tool-execution",
    toolName,
    executionTimeMs,
    success,
    performanceAlert: executionTimeMs > 2000, // Alert if > 2 seconds
    ...metadata,
  };

  if (!success) {
    logger.error(logData, `Tool execution failed: ${toolName}`);
  } else if (executionTimeMs > 5000) {
    logger.warn(logData, `Slow tool execution: ${toolName}`);
  } else {
    logger.info(logData, `Tool execution completed: ${toolName}`);
  }
};

/**
 * Service-level operation logging
 */
export const logServiceOperation = (
  serviceName: string,
  operation: string,
  executionTimeMs: number,
  recordsAffected?: number,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "service-operation",
    serviceName,
    operation,
    executionTimeMs,
    recordsAffected,
    performanceAlert: executionTimeMs > 3000, // Alert if > 3 seconds
    ...metadata,
  };

  if (executionTimeMs > 5000) {
    logger.warn(logData, `Slow service operation: ${serviceName}.${operation}`);
  } else {
    logger.info(
      logData,
      `Service operation completed: ${serviceName}.${operation}`
    );
  }
};

/**
 * Reminder system telemetry
 */
export const logReminderOperation = (
  operation: "schedule" | "dispatch" | "acknowledge" | "escalate",
  reminderRuleId: string,
  userId?: string,
  executionTimeMs?: number,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "reminder-system",
    operation,
    reminderRuleId,
    userId,
    executionTimeMs,
    ...metadata,
  };

  logger.info(logData, `Reminder ${operation}: ${reminderRuleId}`);
};

/**
 * Audit and compliance logging
 */
export const logAuditEvent = (
  eventType: string,
  resourceType: string,
  resourceRef: string,
  actorId: string,
  success: boolean,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "audit-trail",
    eventType,
    resourceType,
    resourceRef,
    actorId,
    success,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  if (!success) {
    logger.error(logData, `Audit event failed: ${eventType}`);
  } else {
    logger.info(logData, `Audit event recorded: ${eventType}`);
  }
};

/**
 * Security event logging
 */
export const logSecurityEvent = (
  eventType:
    | "validation_failure"
    | "sql_injection_attempt"
    | "unauthorized_access"
    | "rate_limit_exceeded",
  severity: "low" | "medium" | "high" | "critical",
  details: string,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "security",
    eventType,
    severity,
    details,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  if (severity === "critical" || severity === "high") {
    logger.error(logData, `Security event: ${eventType}`);
  } else {
    logger.warn(logData, `Security event: ${eventType}`);
  }
};

/**
 * Performance metrics collection
 */
export const logPerformanceMetrics = (
  component: string,
  metrics: {
    responseTimeMs?: number;
    throughputOps?: number;
    errorRate?: number;
    concurrentOperations?: number;
    memoryUsageMB?: number;
    databaseConnections?: number;
  }
) => {
  const logData = {
    component: "performance-metrics",
    target: component,
    ...metrics,
    timestamp: new Date().toISOString(),
  };

  // Check for performance alerts
  const alerts = [];
  if (metrics.responseTimeMs && metrics.responseTimeMs > 5000) {
    alerts.push("high_response_time");
  }
  if (metrics.errorRate && metrics.errorRate > 0.05) {
    alerts.push("high_error_rate");
  }
  if (metrics.concurrentOperations && metrics.concurrentOperations > 10) {
    alerts.push("high_concurrency");
  }

  if (alerts.length > 0) {
    logger.warn(
      { ...logData, alerts },
      `Performance alerts: ${alerts.join(", ")}`
    );
  } else {
    logger.info(logData, `Performance metrics: ${component}`);
  }
};

/**
 * Database operation logging
 */
export const logDatabaseOperation = (
  operation: "read" | "write" | "ddl" | "transaction",
  table: string,
  executionTimeMs: number,
  rowsAffected?: number,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "database",
    operation,
    table,
    executionTimeMs,
    rowsAffected,
    ...metadata,
  };

  if (executionTimeMs > 1000) {
    logger.warn(logData, `Slow database operation: ${operation} on ${table}`);
  } else {
    logger.debug(logData, `Database operation: ${operation} on ${table}`);
  }
};

/**
 * Workflow execution logging
 */
export const logWorkflowExecution = (
  workflowId: string,
  stepId: string,
  status: "started" | "completed" | "failed",
  executionTimeMs?: number,
  metadata?: Record<string, any>
) => {
  const logData = {
    component: "workflow",
    workflowId,
    stepId,
    status,
    executionTimeMs,
    ...metadata,
  };

  if (status === "failed") {
    logger.error(logData, `Workflow step failed: ${workflowId}.${stepId}`);
  } else {
    logger.info(logData, `Workflow step ${status}: ${workflowId}.${stepId}`);
  }
};

// Export the configured logger and all logging functions
export { logger };

// Export logging utilities for use in tools and services
export const createPerformanceTimer = () => {
  const start = Date.now();
  return {
    end: () => Date.now() - start,
  };
};

export const withPerformanceLogging = async <T>(
  operation: string,
  fn: () => Promise<T>,
  logger: (
    op: string,
    time: number,
    success: boolean,
    result?: T,
    error?: Error
  ) => void
): Promise<T> => {
  const timer = createPerformanceTimer();
  try {
    const result = await fn();
    const executionTime = timer.end();
    logger(operation, executionTime, true, result);
    return result;
  } catch (error) {
    const executionTime = timer.end();
    logger(operation, executionTime, false, undefined, error as Error);
    throw error;
  }
};
