# Contract — Admin Catalogue Configuration Tool

## Purpose

Defines the request/response contract for the `catalogueSchemaTool` invoked by the admin Telegram agent when parsing configuration text into actionable schema updates.

## Request Schema (TypeScript)

```ts
export type CatalogueSchemaRequest = {
  adminRuleSetId: string | null; // null creates new version
  parsedAt: string; // ISO timestamp
  sourceText: string;
  metrics: Array<{
    slug: string; // kebab-case unique key
    displayName: string;
    description: string;
    fields: Array<{
      name: string; // snake_case column name
      label: string; // human readable
      dataType:
        | "numeric"
        | "integer"
        | "boolean"
        | "text"
        | "enum"
        | "datetime";
      unit?: string;
      enumValues?: string[];
      required: boolean;
    }>;
    reminderPolicy: {
      schedule: string; // ISO8601 repeating interval or cron-like spec
      timezone: string;
      escalation?: {
        notifyCaregiverAfterMinutes?: number;
        notifyAdminAfterMinutes?: number;
      };
    };
    analyticsTags: string[];
  }>;
  retention: {
    journalRetentionDays: number;
    documentRetentionDays: number;
  };
};
```

## Response Schema (TypeScript)

```ts
export type CatalogueSchemaResponse = {
  ruleSetId: string;
  version: number;
  actions: Array<
    | { type: "create_table"; tableName: string; columns: ColumnSpec[] }
    | {
        type: "alter_table_add_columns";
        tableName: string;
        columns: ColumnSpec[];
      }
    | { type: "no_change"; tableName: string }
  >;
  reminderActions: Array<
    | {
        type: "upsert_rule";
        reminderRuleId: string;
        schedule: string;
        timezone: string;
      }
    | { type: "disable_rule"; reminderRuleId: string }
  >;
  auditEventId: string;
};

type ColumnSpec = {
  name: string;
  sqlType: string;
  nullable: boolean;
  defaultExpression?: string;
};
```

## Error Contract

```ts
export type CatalogueSchemaError = {
  code:
    | "VALIDATION_ERROR"
    | "CONFLICT_SLUG"
    | "UNSUPPORTED_TYPE"
    | "DDL_FAILURE"
    | "RLS_VIOLATION";
  message: string;
  field?: string;
  detail?: unknown;
};
```

## Notes

- All incoming instructions are validated with Zod schemas before tool execution.
- Tool must be idempotent; replays with identical `sourceText` return `no_change` actions.
- Responses are persisted for audit before notifying the admin agent of success.
