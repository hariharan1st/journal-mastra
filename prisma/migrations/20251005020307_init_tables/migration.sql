-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "RuleSetStatus" AS ENUM ('draft', 'published', 'superseded');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('admin', 'user', 'system');

-- CreateEnum
CREATE TYPE "CaregiverRole" AS ENUM ('admin', 'caregiver');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('scheduled', 'sent', 'failed', 'missed', 'acknowledged');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('user_bot', 'caregiver_bot');

-- CreateEnum
CREATE TYPE "DataType" AS ENUM ('int', 'numeric', 'text', 'boolean', 'enum', 'timestamp');

-- CreateEnum
CREATE TYPE "FrequencyType" AS ENUM ('hourly', 'daily', 'weekly', 'as_needed');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('pending', 'granted', 'revoked');

-- CreateTable
CREATE TABLE "admin_rule_sets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "version" SERIAL NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL,
    "published_by" UUID,
    "source_text" TEXT NOT NULL,
    "structured_config" JSONB NOT NULL,
    "status" "RuleSetStatus" NOT NULL DEFAULT 'draft',
    "checksum" TEXT NOT NULL,

    CONSTRAINT "admin_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "event_type" TEXT NOT NULL,
    "resource_ref" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "caregiver_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "role" "CaregiverRole" NOT NULL,
    "telegram_user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,

    CONSTRAINT "caregiver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_embeddings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL,
    "original_filename" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT,
    "checksum" TEXT NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_tables" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "catalogue_item_id" UUID NOT NULL,
    "table_name" TEXT NOT NULL,
    "base_columns" JSONB NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "journal_entry_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_dispatches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "reminder_rule_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMPTZ NOT NULL,
    "delivered_at" TIMESTAMPTZ,
    "acknowledged_at" TIMESTAMPTZ,
    "status" "DispatchStatus" NOT NULL DEFAULT 'scheduled',
    "payload" JSONB NOT NULL,

    CONSTRAINT "reminder_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_rules" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "catalogue_item_id" UUID NOT NULL,
    "schedule_cron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "delivery_channel" "DeliveryChannel" NOT NULL,
    "escalation_policy" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reminder_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_catalogue_fields" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "catalogue_item_id" UUID NOT NULL,
    "column_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data_type" "DataType" NOT NULL,
    "unit_hints" TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT false,
    "enum_values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "example" TEXT,

    CONSTRAINT "tracking_catalogue_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_catalogue_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "rule_set_id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "frequency" "FrequencyType" NOT NULL,
    "reminder_template" JSONB NOT NULL,
    "analytics_tags" TEXT[],

    CONSTRAINT "tracking_catalogue_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "telegram_user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "consent_status" "ConsentStatus" NOT NULL DEFAULT 'pending',
    "consent_recorded_at" TIMESTAMPTZ,
    "health_coach" UUID,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_rule_sets_status_published_at_idx" ON "admin_rule_sets"("status", "published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_rule_sets_version_key" ON "admin_rule_sets"("version");

-- CreateIndex
CREATE INDEX "audit_events_event_type_occurred_at_idx" ON "audit_events"("event_type", "occurred_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "caregiver_profiles_telegram_user_id_key" ON "caregiver_profiles"("telegram_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_tables_catalogue_item_id_key" ON "journal_entry_tables"("catalogue_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entry_tables_table_name_key" ON "journal_entry_tables"("table_name");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_catalogue_fields_catalogue_item_id_column_name_key" ON "tracking_catalogue_fields"("catalogue_item_id", "column_name");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_catalogue_items_slug_key" ON "tracking_catalogue_items"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_catalogue_items_rule_set_id_slug_key" ON "tracking_catalogue_items"("rule_set_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_telegram_user_id_key" ON "user_profiles"("telegram_user_id");

-- AddForeignKey
ALTER TABLE "admin_rule_sets" ADD CONSTRAINT "admin_rule_sets_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "caregiver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_admin_rule_set_fkey" FOREIGN KEY ("actor_id") REFERENCES "admin_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_actor_fkey" FOREIGN KEY ("actor_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_caregiver_actor_fkey" FOREIGN KEY ("actor_id") REFERENCES "caregiver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_embeddings" ADD CONSTRAINT "document_embeddings_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_tables" ADD CONSTRAINT "journal_entry_tables_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "tracking_catalogue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_reminder_rule_id_fkey" FOREIGN KEY ("reminder_rule_id") REFERENCES "reminder_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_dispatches" ADD CONSTRAINT "reminder_dispatches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_rules" ADD CONSTRAINT "reminder_rules_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "tracking_catalogue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_catalogue_fields" ADD CONSTRAINT "tracking_catalogue_fields_catalogue_item_id_fkey" FOREIGN KEY ("catalogue_item_id") REFERENCES "tracking_catalogue_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_catalogue_items" ADD CONSTRAINT "tracking_catalogue_items_rule_set_id_fkey" FOREIGN KEY ("rule_set_id") REFERENCES "admin_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_health_coach_fkey" FOREIGN KEY ("health_coach") REFERENCES "caregiver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
