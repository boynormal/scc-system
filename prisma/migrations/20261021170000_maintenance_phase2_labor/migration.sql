-- Phase 2 labor time entries. Additive only.

CREATE TYPE "LaborEntryType" AS ENUM ('work', 'wait', 'travel');

CREATE TABLE "work_order_labor_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "work_order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entry_type" "LaborEntryType" NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "ended_at" TIMESTAMPTZ,
    "wait_reason" VARCHAR(50),
    "note" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "edit_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "work_order_labor_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_order_labor_entries_time_order_check" CHECK ("ended_at" IS NULL OR "ended_at" > "started_at"),
    CONSTRAINT "work_order_labor_entries_wait_reason_check" CHECK ("entry_type" = 'wait' OR "wait_reason" IS NULL)
);

CREATE INDEX "work_order_labor_entries_work_order_id_idx" ON "work_order_labor_entries"("work_order_id");
CREATE INDEX "work_order_labor_entries_user_id_started_at_idx" ON "work_order_labor_entries"("user_id", "started_at");
CREATE UNIQUE INDEX "work_order_labor_one_open_per_user" ON "work_order_labor_entries"("user_id") WHERE "ended_at" IS NULL;

ALTER TABLE "work_order_labor_entries"
ADD CONSTRAINT "work_order_labor_entries_work_order_id_fkey"
FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_order_labor_entries"
ADD CONSTRAINT "work_order_labor_entries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "work_order_labor_entries"
ADD CONSTRAINT "work_order_labor_entries_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_labor_entries"
ADD CONSTRAINT "work_order_labor_entries_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_order_technicians"
ADD CONSTRAINT "work_order_technicians_work_order_id_user_id_key" UNIQUE ("work_order_id", "user_id");
