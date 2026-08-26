-- Due items: start/end dates, drop unused category / lead time / recurrence

ALTER TABLE "due_items" ADD COLUMN "start_date" DATE;
UPDATE "due_items" SET "start_date" = "due_date" WHERE "start_date" IS NULL;
ALTER TABLE "due_items" ALTER COLUMN "start_date" SET NOT NULL;

ALTER TABLE "due_items" RENAME COLUMN "due_date" TO "end_date";

DROP INDEX IF EXISTS "due_items_due_date_status_idx";
CREATE INDEX "due_items_end_date_status_idx" ON "due_items"("end_date", "status");

ALTER TABLE "due_items" DROP COLUMN "lead_time_days";
ALTER TABLE "due_items" DROP COLUMN "recurrence";
ALTER TABLE "due_items" DROP COLUMN "category";

DROP TYPE IF EXISTS "DueItemCategory";
DROP TYPE IF EXISTS "DueItemRecurrence";

ALTER TABLE "due_item_renewals" ADD COLUMN "previous_start_date" DATE;
ALTER TABLE "due_item_renewals" ADD COLUMN "previous_end_date" DATE;
ALTER TABLE "due_item_renewals" ADD COLUMN "new_start_date" DATE;
ALTER TABLE "due_item_renewals" ADD COLUMN "new_end_date" DATE;

UPDATE "due_item_renewals"
SET
  "previous_start_date" = "previous_due_date",
  "previous_end_date" = "previous_due_date",
  "new_start_date" = "new_due_date",
  "new_end_date" = "new_due_date"
WHERE "previous_start_date" IS NULL;

ALTER TABLE "due_item_renewals" ALTER COLUMN "previous_start_date" SET NOT NULL;
ALTER TABLE "due_item_renewals" ALTER COLUMN "previous_end_date" SET NOT NULL;
ALTER TABLE "due_item_renewals" ALTER COLUMN "new_start_date" SET NOT NULL;
ALTER TABLE "due_item_renewals" ALTER COLUMN "new_end_date" SET NOT NULL;

ALTER TABLE "due_item_renewals" DROP COLUMN "previous_due_date";
ALTER TABLE "due_item_renewals" DROP COLUMN "new_due_date";
