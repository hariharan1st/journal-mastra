# Data Model — Multi-role Telegram Journaling Assistant

## Overview

PostgreSQL (managed through Prisma) houses global catalogue metadata, reminder schedules, dynamic journal tables, document storage metadata, embeddings, and immutable audit trails. Admin caregivers publish one global rule set; Prisma migrations capture structural history for metadata tables, while runtime DDL (executed via Prisma) provisions per-category journal tables in response to admin instructions.

## Core Tables (Prisma Models)

### 1. `admin_rule_sets`

Versioned history of catalogue publications.

- `id` (UUID, PK)
- `version` (INTEGER, auto-increment)
- `published_at` (TIMESTAMPTZ)
- `published_by` (UUID → `caregiver_profiles.id`, nullable until caregiver tooling ships)
- `source_text` (TEXT) — raw admin prompt
- `structured_config` (JSONB) — validated config snapshot
- `status` (ENUM: `draft`, `published`, `superseded`)
- `checksum` (TEXT) — deduplication hash
- Unique index on `(version)` and `(status, published_at DESC)` for fast lookups

### 2. `tracking_catalogue_items`

Catalogue-level categories (e.g., water, medication).

- `id` (UUID, PK)
- `rule_set_id` (UUID → `admin_rule_sets.id`, cascade)
- `slug` (TEXT, unique)
- `display_name` (TEXT)
- `description` (TEXT)
- `frequency` (ENUM: `hourly`, `daily`, `weekly`, `as_needed`)
- `reminder_template` (JSONB) — copy, timezone, escalation metadata
- `analytics_tags` (TEXT[])
- Unique on `(rule_set_id, slug)`

### 3. `tracking_catalogue_fields`

Normalized definition of fields that must exist within each dynamic journal table.

- `id` (UUID, PK)
- `catalogue_item_id` (UUID → `tracking_catalogue_items.id`, cascade)
- `column_name` (TEXT, snake_case, e.g., `quantity`)
- `label` (TEXT, human readable)
- `data_type` (ENUM: `int`, `numeric`, `text`, `boolean`, `enum`, `timestamp`)
- `unit_hints` (TEXT[])
- `required` (BOOLEAN)
- `enum_values` (TEXT[], nullable)
- `example` (TEXT, optional sample phrase)
- Unique on `(catalogue_item_id, column_name)`

### 4. `journal_entry_tables`

Metadata that maps catalogue items to physical Postgres tables.

- `id` (UUID, PK)
- `catalogue_item_id` (UUID → `tracking_catalogue_items.id`, unique)
- `table_name` (TEXT, unique; e.g., `journal_water_intake`)
- `base_columns` (JSONB) — invariant fields enforced across tables
- `schema_version` (INTEGER) — increments on column additions
- `created_at` / `updated_at` (TIMESTAMPTZ)

### 5. Dynamic Journal Tables (`journal_<slug>`)

Created/altered at runtime (DDL executed via Prisma). Shared columns:

- `id` (UUID, PK)
- `user_id` (UUID → `user_profiles.id`)
- `who_recorded` (UUID → `caregiver_profiles.id`, nullable)
- `source_message_id` (TEXT)
- `submitted_at` (TIMESTAMPTZ)
- `recorded_at` (TIMESTAMPTZ DEFAULT now())
- `health_week_label` (ENUM: `healthy`, `unhealthy`, `unspecified`)
- `meta` (JSONB) — parser confidence data
- Category-specific columns defined by `tracking_catalogue_fields` (e.g., `quantity NUMERIC`, `unit TEXT`, `logged_for TIMESTAMPTZ`)
- Indices: `(user_id, recorded_at DESC)`, `(recorded_at DESC)` and optional partial indexes for high-volume metrics

### 6. `user_profiles`

- `id` (UUID, PK)
- `telegram_user_id` (TEXT, unique)
- `display_name` (TEXT)
- `timezone` (TEXT)
- `consent_status` (ENUM: `pending`, `granted`, `revoked`)
- `consent_recorded_at` (TIMESTAMPTZ)
- `health_coach` (UUID → `caregiver_profiles.id`, nullable future use)

### 7. `caregiver_profiles`

- `id` (UUID, PK)
- `role` (ENUM: `admin`, `caregiver`)
- `telegram_user_id` (TEXT, unique)
- `display_name` (TEXT)
- `organization` (TEXT)

### 8. `reminder_rules`

- `id` (UUID, PK)
- `catalogue_item_id` (UUID → `tracking_catalogue_items.id`)
- `schedule_cron` (TEXT)
- `timezone` (TEXT)
- `delivery_channel` (ENUM: `user_bot`, `caregiver_bot`)
- `escalation_policy` (JSONB)
- `active` (BOOLEAN)

### 9. `reminder_dispatches`

- `id` (UUID, PK)
- `reminder_rule_id` (UUID → `reminder_rules.id`)
- `user_id` (UUID → `user_profiles.id`)
- `scheduled_for` (TIMESTAMPTZ)
- `delivered_at` (TIMESTAMPTZ, nullable)
- `acknowledged_at` (TIMESTAMPTZ, nullable)
- `status` (ENUM: `scheduled`, `sent`, `failed`, `missed`, `acknowledged`)
- `payload` (JSONB)

### 10. `documents`

- `id` (UUID, PK)
- `user_id` (UUID → `user_profiles.id`)
- `original_filename` (TEXT)
- `storage_path` (TEXT)
- `mime_type` (TEXT)
- `uploaded_at` (TIMESTAMPTZ)
- `summary` (TEXT)
- `checksum` (TEXT)

### 11. `document_embeddings`

- `id` (UUID, PK)
- `document_id` (UUID → `documents.id`, cascade)
- `chunk_index` (INTEGER)
- `content` (TEXT)
- `embedding` (VECTOR via `pgvector`)
- `created_at` (TIMESTAMPTZ)
- HNSW index on `embedding`

### 12. `audit_events`

- `id` (UUID, PK)
- `occurred_at` (TIMESTAMPTZ DEFAULT now())
- `actor_type` (ENUM: `admin`, `user`, `system`)
- `actor_id` (UUID, nullable)
- `event_type` (TEXT; e.g., `catalogue.schema_change`, `journal.inserted`)
- `resource_ref` (TEXT)
- `payload` (JSONB)
- Composite index `(event_type, occurred_at DESC)`

## Relationships

- `admin_rule_sets` 1→N `tracking_catalogue_items`
- `tracking_catalogue_items` 1→N `tracking_catalogue_fields`
- `tracking_catalogue_items` 1→1 `journal_entry_tables`
- `tracking_catalogue_items` 1→N `reminder_rules`
- `user_profiles` 1→N dynamic journal tables, `reminder_dispatches`, `documents`
- `documents` 1→N `document_embeddings`
- `caregiver_profiles` 1→N `user_profiles` (future caregiver tooling)

## Dynamic Schema Governance

- `catalogueSchemaTool` loads `tracking_catalogue_fields` for a slug, compares to `information_schema.columns`, and determines whether to `CREATE TABLE` or `ALTER TABLE ADD COLUMN` using Prisma `.$executeRaw` within a transaction.
- Base columns (`user_id`, `who_recorded`, `submitted_at`, `recorded_at`, `health_week_label`, `meta`) are enforced for every dynamic table; Prisma migrations track their definition in a reusable SQL template.
- Column additions increment `journal_entry_tables.schema_version`, persist the change payload to `audit_events`, and attach to the active `admin_rule_sets` version.
- Destructive changes are disallowed; requests for removals queue manual review tasks instead of executing automatically.

## Data Retention & Compliance Notes

- Retention policies (`journalRetentionDays`, `documentRetentionDays`) stored on `admin_rule_sets` feed a scheduled retention runner that archives or deletes data while keeping audit logs intact.
- Row-level security (enforced later in implementation) restricts dynamic table access to the owning `user_profiles.id` and privileged caregivers.
- `audit_events` capture agent identity, Telegram message IDs, and before/after schema snapshots to meet HIPAA/GDPR traceability.
