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
| MV-08    | Dynamic table evolution & schema changes  | Table alteration logs + field addition verification      |

## Detailed Flows

### MV-01 — Publish Catalogue

1. Start Mastra dev server and connect admin Telegram bot.
2. Send configuration prompt describing at least two metrics (water, medication) with field requirements.
3. Observe bot confirmation summarizing parsed schema.
4. Inspect Mastra logs for `catalogueSchemaTool` execution entries and dynamic table operations.
5. Query Postgres to verify catalogue creation:

   ```sql
   -- Check catalogue items
   SELECT slug, display_name, frequency FROM tracking_catalogue_items;

   -- Check catalogue fields
   SELECT ci.slug, cf.column_name, cf.data_type, cf.required
   FROM tracking_catalogue_fields cf
   JOIN tracking_catalogue_items ci ON cf.catalogue_item_id = ci.id;

   -- Check admin rule set versioning
   SELECT version, status, published_at FROM admin_rule_sets ORDER BY version DESC;
   ```

6. Verify dynamic table creation:

   ```sql
   -- Check that dynamic journal tables were created
   SELECT table_name FROM information_schema.tables
   WHERE table_name LIKE 'journal_%' AND table_schema = 'public';

   -- Inspect table structure for water intake
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'journal_water_intake';
   ```

7. Check audit events for schema operations:
   ```sql
   SELECT event_type, resource_type, payload
   FROM audit_events
   WHERE event_type LIKE '%catalogue%'
   ORDER BY created_at DESC;
   ```

**Expected Result**: Catalogue items created with proper field definitions, dynamic tables exist with correct schemas, comprehensive audit trail captured.

### MV-02 — Log Journal Entries

1. Using user bot, submit water intake message (e.g., "Drank 500 ml at 9 AM").
2. Submit medication adherence message (e.g., "Took Lipitor 20mg at 9 PM; 25 pills left").
3. Verify tool inserted rows via Prisma client or SQL:
   - `SELECT quantity, unit FROM journal_water_intake ORDER BY recorded_at DESC LIMIT 1;`
   - `SELECT dosage_mg, supply_remaining FROM journal_medications ORDER BY recorded_at DESC LIMIT 1;`

**Expected Result**: Parsed values match message content; bot acknowledges capture.

### MV-03 — Reminder Delivery & Rule Management

1. Verify reminder rules were created during catalogue setup:

   ```sql
   -- Check reminder rules configuration
   SELECT rr.id, ci.slug, rr.schedule, rr.timezone, rr.enabled
   FROM reminder_rules rr
   JOIN tracking_catalogue_items ci ON rr.catalogue_item_id = ci.id;

   -- Check escalation policies
   SELECT escalation_config FROM reminder_rules WHERE escalation_config IS NOT NULL;
   ```

2. Configure schedule for water intake reminders every 2 hours (or use bootstrap schedule).
3. Fast-forward scheduler (or trigger manual job) to send reminder.
4. Confirm Telegram reminder delivered and acknowledgement tracked by responding "Done".
5. Query `reminder_dispatches` for status progression:
   ```sql
   SELECT rd.status, rd.scheduled_at, rd.sent_at, rd.acknowledged_at,
          ci.slug as category, rr.schedule
   FROM reminder_dispatches rd
   JOIN reminder_rules rr ON rd.reminder_rule_id = rr.id
   JOIN tracking_catalogue_items ci ON rr.catalogue_item_id = ci.id
   ORDER BY rd.scheduled_at DESC;
   ```
6. Test reminder rule updates by sending admin agent a configuration change (e.g., changing reminder frequency).
7. Verify that reminder rules are properly synchronized:
   ```sql
   -- Check for reminder sync audit events
   SELECT payload FROM audit_events
   WHERE event_type = 'reminder.rules_synced'
   ORDER BY created_at DESC LIMIT 5;
   ```

**Expected Result**: Reminder rules properly configured, delivered within scheduled windows, acknowledgements recorded, rule updates synchronized correctly.

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

### MV-08 — Dynamic Table Evolution & Schema Changes

1. **Test additive schema changes**: Send admin agent a configuration that adds new fields to existing categories:
   ```
   Update water intake tracking to include: temperature (hot/cold/room), flavor (plain/lemon/mint), container_type (glass/bottle/cup)
   ```
2. Verify that the catalogue schema tool detects the changes and plans table alterations:
   ```sql
   -- Check that new fields were added to catalogue
   SELECT column_name, data_type, required
   FROM tracking_catalogue_fields cf
   JOIN tracking_catalogue_items ci ON cf.catalogue_item_id = ci.id
   WHERE ci.slug = 'water-intake'
   ORDER BY cf.created_at;
   ```
3. Confirm dynamic table was altered (not recreated):
   ```sql
   -- Verify new columns were added to existing table
   SELECT column_name, data_type, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name = 'journal_water_intake'
   ORDER BY ordinal_position;
   ```
4. **Test no-change detection**: Send identical configuration again and verify no DDL operations occur:
   ```sql
   -- Check audit events for no-change detection
   SELECT payload->>'tableActions' as actions
   FROM audit_events
   WHERE event_type = 'catalogue.schema_update'
   ORDER BY created_at DESC LIMIT 1;
   ```
5. **Test new category addition**: Add completely new tracking category and verify table creation:
   ```
   Add sleep tracking: bedtime (datetime), wake_time (datetime), sleep_quality (1-10), dream_notes (optional text).
   Remind at 10 PM daily for bedtime logging.
   ```
6. Verify comprehensive audit trail captures all operations:
   ```sql
   -- Check complete workflow audit trail
   SELECT actor_type, event_type, resource_type,
          payload->>'summary' as operation_summary
   FROM audit_events
   WHERE created_at >= NOW() - INTERVAL '1 hour'
   ORDER BY created_at;
   ```

**Expected Result**: Schema evolution is additive-only, existing data preserved, proper audit trails for all DDL operations, no-change scenarios handled efficiently.

## Evidence Packaging

- Store transcripts, SQL outputs, and screenshots in `docs/validations/001-this-is-a/`.
- Include README summarizing validation results and link to audit event IDs for compliance review.
