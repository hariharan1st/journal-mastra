/*
  Warnings:

  - You are about to drop the column `actor_id` on the `audit_events` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."audit_events" DROP CONSTRAINT "audit_events_admin_rule_set_fkey";

-- DropForeignKey
ALTER TABLE "public"."audit_events" DROP CONSTRAINT "audit_events_caregiver_actor_fkey";

-- DropForeignKey
ALTER TABLE "public"."audit_events" DROP CONSTRAINT "audit_events_user_actor_fkey";

-- AlterTable
ALTER TABLE "audit_events" DROP COLUMN "actor_id",
ADD COLUMN     "admin_actor_id" UUID,
ADD COLUMN     "caregiver_actor_id" UUID,
ADD COLUMN     "user_actor_id" UUID;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_admin_actor_id_fkey" FOREIGN KEY ("admin_actor_id") REFERENCES "admin_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_actor_id_fkey" FOREIGN KEY ("user_actor_id") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_caregiver_actor_id_fkey" FOREIGN KEY ("caregiver_actor_id") REFERENCES "caregiver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
