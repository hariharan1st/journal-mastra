# Contract — Journal Writer Tool

## Purpose

Defines the interface for the `journalWriterTool` that receives parsed user messages and persists structured records into the appropriate dynamic journal tables.

## Request Schema (TypeScript)

```ts
export type JournalWriterRequest = {
  userId: string;
  telegramMessageId: string;
  receivedAt: string; // ISO timestamp from Telegram
  catalogueItemSlug: string; // maps to tracking_catalogue_items.slug
  healthWeekLabel?: "healthy" | "unhealthy";
  parsedFields: Array<{
    name: string; // column name
    value: string | number | boolean | null;
    confidence: number; // 0-1
    unit?: string;
  }>;
  freeformNotes?: string;
};
```

## Response Schema (TypeScript)

```ts
export type JournalWriterResponse = {
  journalTable: string;
  insertedRecordId: string;
  normalizedFields: Array<{
    name: string;
    value: string | number | boolean | null;
  }>;
  promptsIssued: Array<{
    type: "missing_field" | "low_confidence" | "follow_up";
    message: string;
  }>;
  auditEventId: string;
};
```

## Error Contract

```ts
export type JournalWriterError = {
  code:
    | "UNKNOWN_CATALOGUE_ITEM"
    | "VALIDATION_FAILED"
    | "DB_WRITE_ERROR"
    | "CONSENT_REVOKED"
    | "RLS_DENIED";
  message: string;
  remediation?: string;
};
```

## Notes

- Tool must enforce row-level security by checking the user’s consent status before insert.
- If required fields are missing, the tool returns prompts so the agent can request clarification instead of inserting incomplete data.
- Dynamic tables are resolved via `journal_entry_tables` metadata to avoid SQL injection.
