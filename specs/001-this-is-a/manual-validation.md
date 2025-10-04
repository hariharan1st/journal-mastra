# Manual Validation Plan — Multi-role Telegram Journaling Assistant

## Test Matrix Overview

| Scenario | Description                               | Evidence to Capture                                      |
| -------- | ----------------------------------------- | -------------------------------------------------------- |
| MV-01    | Admin publishes global tracking catalogue | Telegram transcript + Prisma migration log + audit event |
| MV-02    | User logs journal entries per catalogue   | Transcript + `journal_*` table rows                      |
| MV-03    | Reminder delivery & acknowledgement       | Reminder logs + user acknowledgement screenshot          |
| MV-04    | Historical summary query                  | Bot response screenshot + SQL output                     |
| MV-05    | Healthy vs. unhealthy week analysis       | Bot response + supporting metrics                        |
| MV-06    | Document ingestion & semantic answer      | Transcript + cited document details                      |
| MV-07    | Compliance + retention checks             | Audit event queries + consent state screenshot           |

## Detailed Flows

### MV-01 — Publish Catalogue

1. Start Mastra dev server and connect admin Telegram bot.
2. Send configuration prompt describing at least two metrics (water, medication) with field requirements.
3. Observe bot confirmation summarizing parsed schema.
4. Inspect Prisma migration logs / telemetry for recorded runtime DDL (e.g., `catalogueSchemaTool` info entry).
5. Query Postgres:
   - `SELECT slug, table_name FROM journal_entry_tables;`
   - `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'journal_water_intake';`
6. Check `audit_events` for `catalogue.schema_change` entry with column diff payload.

**Expected Result**: Two catalogue items created, corresponding dynamic tables exist, audit log captured.

### MV-02 — Log Journal Entries

1. Using user bot, submit water intake message (e.g., "Drank 500 ml at 9 AM").
2. Submit medication adherence message (e.g., "Took Lipitor 20mg at 9 PM; 25 pills left").
3. Verify tool inserted rows via Prisma client or SQL:
   - `SELECT quantity, unit FROM journal_water_intake ORDER BY recorded_at DESC LIMIT 1;`
   - `SELECT dosage_mg, supply_remaining FROM journal_medications ORDER BY recorded_at DESC LIMIT 1;`

**Expected Result**: Parsed values match message content; bot acknowledges capture.

### MV-03 — Reminder Delivery

1. Configure schedule for water intake reminders every 2 hours.
2. Fast-forward scheduler (or trigger manual job) to send reminder.
3. Confirm Telegram reminder delivered and acknowledgement tracked by responding "Done".
4. Query `reminder_dispatches` for status progression from `scheduled` → `sent` → `acknowledged`.

**Expected Result**: Reminder delivered within configured window, acknowledgement recorded.

### MV-04 — Historical Summary Query

1. Ask user bot: "How many times did I drink water yesterday?"
2. Bot should respond with aggregated count and total quantity.
3. Cross-check with SQL aggregation to confirm accuracy.

**Expected Result**: Counts align with database; response cites time window.

### MV-05 — Healthy Week Analysis

1. Label last week as `healthy` and current week as `unhealthy` via bot commands.
2. Ask: "Why was this week unhealthy compared to last week?"
3. Bot compares activity counts, flags missing entries, and references data gaps if present.
4. Capture response and any mention of insufficient data.

**Expected Result**: Explanation references specific metrics (e.g., decreased workouts) and notes uncertain areas.

### MV-06 — Document Ingestion & Answering

1. Upload sample PDF (e.g., prescription).
2. Bot confirms ingestion and chunk count.
3. Ask question referencing document ("What dosage did Dr. Smith recommend?").
4. Response should cite document title and relevant excerpt.
5. Query `document_embeddings` for new vectors.
6. Confirm audit event `document.ingested` recorded.

**Expected Result**: Answer grounded in document with citation, embeddings present.

### MV-07 — Compliance & Retention

1. Revoke consent for a test user; ensure journaling features disable appropriately.
2. Trigger data export routine and confirm audit trail entry `privacy.subject_access`.
3. Verify role-based access: attempt to query as caregiver (future scope) and confirm denial (log entry `security.rls_denied`).
4. Export audit log subset for compliance review using Prisma.

**Expected Result**: Consent state enforced, audit events recorded, unauthorized access blocked.

## Evidence Packaging

- Store transcripts, SQL outputs, and screenshots in `docs/validations/001-this-is-a/`.
- Include README summarizing validation results and link to audit event IDs for compliance review.
