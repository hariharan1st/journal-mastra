-- AlterTable
ALTER TABLE "admin_rule_sets" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "audit_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "caregiver_profiles" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "document_embeddings" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "documents" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "journal_entry_tables" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reminder_dispatches" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "reminder_rules" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tracking_catalogue_fields" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tracking_catalogue_items" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user_profiles" ALTER COLUMN "id" DROP DEFAULT;
