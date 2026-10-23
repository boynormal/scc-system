-- Phase 3 PM. Unique indexes fail on duplicate rows on purpose; they are never rewritten here.

CREATE UNIQUE INDEX "maintenance_schedules_plan_id_due_date_key" ON "maintenance_schedules"("plan_id", "due_date");

CREATE UNIQUE INDEX "work_orders_schedule_id_key" ON "work_orders"("schedule_id");

ALTER TABLE "work_orders"
ADD COLUMN "source_work_order_id" UUID,
ADD COLUMN "source_checklist_result_id" UUID;

CREATE UNIQUE INDEX "work_orders_source_checklist_result_id_key" ON "work_orders"("source_checklist_result_id");
CREATE INDEX "work_orders_source_work_order_id_idx" ON "work_orders"("source_work_order_id");

ALTER TABLE "work_orders"
ADD CONSTRAINT "work_orders_source_work_order_id_fkey"
FOREIGN KEY ("source_work_order_id") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "work_orders"
ADD CONSTRAINT "work_orders_source_checklist_result_id_fkey"
FOREIGN KEY ("source_checklist_result_id") REFERENCES "checklist_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "checklist_results" ALTER COLUMN "status" DROP NOT NULL;
ALTER TABLE "checklist_results" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "checklist_results" ALTER COLUMN "recorded_at" DROP NOT NULL;
ALTER TABLE "checklist_results" ALTER COLUMN "recorded_at" DROP DEFAULT;

CREATE UNIQUE INDEX "checklist_results_work_order_id_item_id_key" ON "checklist_results"("work_order_id", "item_id");
