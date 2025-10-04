# Data Model — Multi-role Telegram Journaling Assistant

## Overview

The journaling platform stores globally managed tracking catalogues, per-user journal entries, reminder schedules, uploaded documents, and compliance audit logs in PostgreSQL. Admin caregivers configure the catalogue once; all organizations and users share the resulting schema. The system dynamically provisions per-category journal tables while preserving immutable configuration history for traceability.

## Core Tables

### 1. `admin_rule_sets`

Captures each published version of the global catalogue.

- `id` (UUID, PK)
- `version` (INTEGER, auto-increment)
- `published_at` (TIMESTAMPTZ, required)
- `published_by` (UUID → `user_profiles.id`, nullable until caregiver expansion)
- `source_text` (TEXT, original admin instruction payload)
- `structured_config` (JSONB, validated schema definition)
- `status` (ENUM: `draft`, `published`, `superseded`)
- `checksum` (TEXT, used to detect duplicate submissions)
- Index: `(status, published_at DESC)`

### 2. `tracking_catalogue_items`

Represents each trackable metric defined in the active rule set.

- `id` (UUID, PK)
- `rule_set_id` (UUID → `admin_rule_sets.id`, on delete cascade)
- `slug` (TEXT, unique, kebab-case identifier e.g. `water-intake`)
- `display_name` (TEXT)
- `data_type` (ENUM: `numeric`, `boolean`, `text`, `enum`, `datetime`)
- `unit_hints` (TEXT[], e.g. `["ml", "oz"]`)
- `frequency` (ENUM: `daily`, `hourly`, `as-needed`)
- `reminder_template` (JSONB; stores message copy + schedule)
- `analytics_tags` (TEXT[])
- Index: `(rule_set_id, slug)` unique

### 3. `journal_entry_tables`

Metadata describing dynamically generated per-category tables.

- `id` (UUID, PK)
- `catalogue_item_id` (UUID → `tracking_catalogue_items.id`, unique)
- `table_name` (TEXT, unique, e.g. `journal_water_intake`)
- `schema_definition` (JSONB; column list with types and nullable flags)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### 4. Dynamic Journal Tables (one per catalogue item)

Each table shares the same base columns plus category-specific columns inferred from `schema_definition`.

- `id` (UUID, PK)
- `user_id` (UUID → `user_profiles.id`)
- `source_message_id` (TEXT, Telegram message identifier)
- `recorded_at` (TIMESTAMPTZ, defaults to now)
- `submitted_at` (TIMESTAMPTZ, message timestamp)
- `health_week_label` (ENUM: `healthy`, `unhealthy`, `unspecified`)
- `meta` (JSONB, optional raw parse output)
- **Category-specific fields** (e.g., `quantity NUMERIC`, `unit TEXT`, `logged_for TIMESTAMPTZ`)
- Indices: `(user_id, recorded_at DESC)`, GIN index on `meta`

### 5. `user_profiles`

Primary subject record for journaling users.

- `id` (UUID, PK)
- `telegram_user_id` (TEXT, unique)
- `display_name` (TEXT)
- `timezone` (TEXT)
- `caregiver_id` (UUID → `caregiver_profiles.id`, nullable until caregiver tooling ships)
- `consent_status` (ENUM: `pending`, `granted`, `revoked`)
- `consent_recorded_at` (TIMESTAMPTZ)

### 6. `caregiver_profiles`

Provisioned for future caregiver expansion (kept minimal for now).

- `id` (UUID, PK)
- `role` (ENUM: `admin`, `caregiver`)
- `telegram_user_id` (TEXT, unique)
- `display_name` (TEXT)
- `organization` (TEXT)

### 7. `reminder_rules`

Mirror admin reminder definitions for scheduling.

- `id` (UUID, PK)
- `catalogue_item_id` (UUID → `tracking_catalogue_items.id`)
- `schedule` (JSONB; cron-like expression + timezone)
- `delivery_channel` (ENUM: `user_bot`, `caregiver_bot`)
- `escalation_policy` (JSONB; retries, caregiver notifications)
- `active` (BOOLEAN)

### 8. `reminder_dispatches`

Tracks reminder delivery and acknowledgement.

- `id` (UUID, PK)
- `reminder_rule_id` (UUID → `reminder_rules.id`)
- `user_id` (UUID → `user_profiles.id`)
- `scheduled_for` (TIMESTAMPTZ)
- `delivered_at` (TIMESTAMPTZ, nullable)
- `acknowledged_at` (TIMESTAMPTZ, nullable)
- `status` (ENUM: `scheduled`, `sent`, `failed`, `missed`, `acknowledged`)
- `delivery_payload` (JSONB)

### 9. `documents`

Stores uploaded document metadata.

- `id` (UUID, PK)
- `user_id` (UUID → `user_profiles.id`)
- `original_filename` (TEXT)
- `storage_path` (TEXT, absolute path on encrypted volume)
- `mime_type` (TEXT)
- `uploaded_at` (TIMESTAMPTZ)
- `summary` (TEXT)
- `checksum` (TEXT)

### 10. `document_embeddings`

Embedding vectors per document chunk.

- `id` (UUID, PK)
- `document_id` (UUID → `documents.id` on delete cascade)
- `chunk_index` (INTEGER)
- `content` (TEXT)
- `embedding` (VECTOR using `pgvector`)
- `created_at` (TIMESTAMPTZ)
- Index: HNSW index on `embedding`

### 11. `audit_events`

Compliance audit log with immutable payloads.

- `id` (UUID, PK)
- `occurred_at` (TIMESTAMPTZ DEFAULT now())
- `actor_type` (ENUM: `admin`, `user`, `system`)
- `actor_id` (UUID nullable for system events)
- `event_type` (TEXT, e.g., `catalogue.updated`, `journal.inserted`, `document.retrieved`)
- `resource_ref` (TEXT)
- `payload` (JSONB)
- Index: `(event_type, occurred_at DESC)`

## Relationships

- `admin_rule_sets` 1→N `tracking_catalogue_items`
- `tracking_catalogue_items` 1→1 `journal_entry_tables`
- `tracking_catalogue_items` 1→N `reminder_rules`
- `user_profiles` 1→N dynamic journal tables, `reminder_dispatches`, `documents`
- `documents` 1→N `document_embeddings`
- `user_profiles` N→1 `caregiver_profiles` (future)

## Dynamic Schema Governance

- Each catalogue item stores machine-readable field definitions (name, SQL type, nullability, semantic label).
- The `catalogueSchemaTool` compares incoming definitions against `journal_entry_tables.schema_definition` to determine whether to `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, or no-op.
- Schema updates emit `audit_events` (`event_type = catalogue.schema_change`) and append a new `admin_rule_sets` version.
- Downgrades and destructive migrations are disallowed; new fields must be additive.

## Data Retention & Compliance Notes

- Journal entries and documents inherit tenant-wide retention rules (configurable via `admin_rule_sets`), enforced by scheduled jobs that mark records for archival but retain audit history.
- `audit_events` are write-once and protected via row-level security policies to prevent tampering.
- Access to dynamic journal tables is mediated by views that enforce row-level security per `user_profiles.id`.
