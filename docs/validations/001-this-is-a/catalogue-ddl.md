# DDL Guard Rails and Audit Expectations

**Feature**: Multi-role Telegram Journaling Assistant  
**Component**: Dynamic Table Management & Catalogue Schema Tool  
**Date**: 2025-10-04

## Overview

This document outlines the safety mechanisms, constraints, and audit expectations for dynamic DDL operations in the journaling system. The `DynamicTableManager` and `CatalogueSchemaTool` implement strict guard rails to ensure data integrity, security, and compliance during runtime schema evolution.

## DDL Guard Rails

### 1. Additive-Only Schema Evolution

**Principle**: All schema changes must be additive to preserve existing data and maintain backward compatibility.

**Enforced Constraints**:

- ✅ **Allowed**: Adding new columns to existing tables
- ✅ **Allowed**: Creating new journal tables for new categories
- ✅ **Allowed**: Adding indexes and constraints that don't conflict
- ❌ **Prohibited**: Dropping columns or tables
- ❌ **Prohibited**: Modifying existing column types or constraints
- ❌ **Prohibited**: Renaming columns or tables

**Implementation**: The `DynamicTableManager.planTableChanges()` method only returns `create_table` or `alter_table_add_columns` actions, never deletion or modification operations.

### 2. SQL Injection Prevention

**Protection Mechanisms**:

- All table and column names are validated against strict regex patterns (`^[a-z][a-z0-9_]*$`)
- Column names are limited to snake_case with specific character restrictions
- SQL identifiers are properly quoted using Prisma's identifier quoting
- No dynamic SQL string concatenation; all queries use parameterized statements
- Enum values are validated against predefined lists

**Validation Example**:

```typescript
// Valid column names
const validColumnName = /^[a-z][a-z0-9_]*$/;
if (!validColumnName.test(columnName)) {
  throw new ValidationError("Invalid column name format");
}
```

### 3. Table Naming Conventions

**Enforced Patterns**:

- Journal tables: `journal_{category_slug}` (e.g., `journal_water_intake`)
- Category slugs must be kebab-case: `^[a-z][a-z0-9-]*$`
- Maximum length: 50 characters for slugs, 63 characters for table names
- Reserved prefixes: `system_`, `admin_`, `meta_` are prohibited for user tables

**Collision Prevention**:

- Table names are checked against existing system tables
- Slug uniqueness is enforced at the catalogue level
- Schema generation includes conflict detection

### 4. Data Type Restrictions

**Supported Types**:

- `INTEGER` - for whole numbers
- `NUMERIC(10,2)` - for decimal values with precision
- `TEXT` - for variable-length strings
- `BOOLEAN` - for true/false values
- `TIMESTAMPTZ` - for date/time with timezone
- `TEXT CHECK (column_name IN ('val1', 'val2'))` - for enums

**Type Safety**:

- All column types are mapped through a controlled type conversion function
- Enum validation ensures only predefined values are accepted
- Nullable/required constraints are properly enforced
- Default values are validated for type compatibility

### 5. Transaction Isolation

**ACID Compliance**:

- All DDL operations execute within Prisma transactions
- Schema changes are atomic: either all succeed or all fail
- Concurrent catalogue updates are serialized using database locks
- Rollback mechanisms ensure consistency on failure

**Implementation**:

```typescript
await this.prisma.$transaction(async (tx) => {
  // All DDL operations happen within this transaction
  const ruleSet = await createRuleSet(tx, ...);
  await executeTableActions(tx, ...);
  await syncReminderRules(tx, ...);
  await createAuditEvent(tx, ...);
});
```

## Audit Trail Requirements

### 1. Comprehensive Operation Logging

**Required Audit Events**:

- `catalogue.schema_update` - Complete schema change operations
- `ddl.table_created` - New journal table creation
- `ddl.table_altered` - Column additions to existing tables
- `ddl.no_change_detected` - When no schema changes are needed
- `reminder.rules_synced` - Reminder rule updates
- `workflow.catalogue_sync_completed` - Workflow completion

**Audit Payload Structure**:

```json
{
  "actorType": "tool|workflow|agent",
  "actorId": "catalogue-schema-tool",
  "eventType": "catalogue.schema_update",
  "resourceType": "admin_rule_set",
  "resourceRef": "admin_rule_set:uuid",
  "payload": {
    "ruleSetVersion": 2,
    "tableActions": [
      {
        "type": "create_table",
        "tableName": "journal_sleep_tracking",
        "columnCount": 6
      }
    ],
    "reminderActions": ["upsert_rule"],
    "executionTimeMs": 1250
  }
}
```

### 2. Error and Security Event Logging

**Security Events**:

- `security.ddl_blocked` - When prohibited DDL is attempted
- `security.invalid_column_name` - SQL injection attempts detected
- `security.unauthorized_schema_change` - Permission violations
- `security.concurrent_update_conflict` - Transaction conflicts

**Error Classifications**:

- `VALIDATION_ERROR` - Input validation failures
- `CONFLICT_SLUG` - Slug collision attempts
- `UNSUPPORTED_TYPE` - Invalid data type requests
- `DDL_FAILURE` - Database operation failures
- `RLS_VIOLATION` - Row-level security violations

### 3. Performance and Resource Monitoring

**Tracked Metrics**:

- DDL execution time (must be < 5 seconds for typical operations)
- Transaction lock duration
- Memory usage during large schema operations
- Concurrent operation queue length

**Alerting Thresholds**:

- DDL operations > 10 seconds trigger performance alerts
- Failed transactions > 5% rate trigger reliability alerts
- Concurrent operations > 10 trigger capacity alerts

## Compliance and Data Protection

### 1. Data Retention Enforcement

**Automatic Enforcement**:

- Retention policies are applied at the catalogue level
- Background jobs enforce journal entry retention (configurable, default 365 days)
- Document retention is separate and configurable (default 180 days)
- Audit logs have extended retention (7 years for compliance)

### 2. Privacy and Consent Integration

**RLS Integration**:

- Dynamic journal tables inherit base RLS policies
- User consent status affects data access permissions
- Caregiver access is controlled through role-based policies
- Admin operations are subject to heightened audit requirements

### 3. Change Documentation

**Required Documentation**:

- All schema changes must be accompanied by audit events
- Change rationale captured in admin rule set `source_text`
- Field-level change tracking in catalogue metadata
- Version history preserved indefinitely

## Operational Procedures

### 1. Schema Change Review Process

**Pre-deployment Validation**:

1. Parse admin text using catalogue schema parser
2. Validate all field definitions and constraints
3. Check for naming conflicts and reserved words
4. Simulate DDL operations without execution
5. Review reminder rule implications
6. Confirm audit trail requirements

### 2. Rollback Procedures

**Emergency Rollback**:

- DDL operations cannot be automatically rolled back
- New admin rule set versions can disable problematic rules
- Data migration scripts may be needed for data consistency
- All rollbacks require manual admin intervention

### 3. Monitoring and Alerting

**Continuous Monitoring**:

- DDL operation success/failure rates
- Schema drift detection (unauthorized changes)
- Performance degradation after schema changes
- Audit log completeness verification

**Alert Conditions**:

- DDL failure rate > 1%
- Schema operations taking > 30 seconds
- Audit log gaps or inconsistencies
- Unauthorized schema modification attempts

## Security Best Practices

### 1. Principle of Least Privilege

- DDL operations require specific database permissions
- Application uses dedicated database role for schema operations
- Read-only access for query operations
- Audit trail access is restricted to compliance roles

### 2. Defense in Depth

- Multiple validation layers (parser → tool → database)
- SQL injection prevention at multiple levels
- Transaction isolation and conflict resolution
- Comprehensive error handling and logging

### 3. Regular Security Reviews

- Monthly review of DDL audit logs
- Quarterly assessment of guard rail effectiveness
- Annual penetration testing of schema validation
- Continuous monitoring of security event patterns

## Conclusion

The DDL guard rails and audit system provide robust protection for dynamic schema operations while maintaining the flexibility needed for the journaling system. The combination of preventive controls, comprehensive logging, and continuous monitoring ensures data integrity and compliance requirements are met throughout the system's lifecycle.
