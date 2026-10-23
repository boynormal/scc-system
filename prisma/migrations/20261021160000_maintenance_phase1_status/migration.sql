-- Wipe unused maintenance-owned rows. Do not touch expenses, spare part stock,
-- suppliers, departments, users, personnel, assets, transport, or attendance.
UPDATE "spare_part_transactions" SET "work_order_id" = NULL WHERE "work_order_id" IS NOT NULL;

DELETE FROM "notifications"
WHERE "type" IN ('wo_assigned', 'wo_completed', 'overdue_schedule', 'upcoming_maintenance');

DELETE FROM "audit_logs"
WHERE "table_name" IN (
  'work_orders',
  'maintenance_plans',
  'maintenance_schedules',
  'machines',
  'machine_categories',
  'maintenance_types',
  'checklist_templates',
  'checklist_results'
);

DELETE FROM "checklist_results";
DELETE FROM "work_order_parts";
DELETE FROM "work_order_technicians";
DELETE FROM "work_orders";
DELETE FROM "maintenance_schedules";
DELETE FROM "plan_checklist_templates";
DELETE FROM "maintenance_plans";
DELETE FROM "checklist_items";
DELETE FROM "checklist_templates";
DELETE FROM "machine_images";
DELETE FROM "machine_documents";
DELETE FROM "machine_products";
DELETE FROM "machine_spare_parts";
DELETE FROM "machines";
DELETE FROM "maintenance_types";
UPDATE "machine_categories" SET "parent_id" = NULL WHERE "parent_id" IS NOT NULL;
DELETE FROM "machine_categories";

-- Additive status model. Existing work_orders rows were removed above.
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'ready_for_handover';
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'handed_over';
ALTER TYPE "WorkOrderStatus" ADD VALUE IF NOT EXISTS 'closed';

CREATE TYPE "WorkOrderKind" AS ENUM ('corrective', 'preventive', 'project');

ALTER TABLE "work_orders"
ADD COLUMN "work_kind" "WorkOrderKind" NOT NULL DEFAULT 'corrective';

CREATE TABLE "work_order_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "work_order_id" UUID NOT NULL,
    "from_status" "WorkOrderStatus",
    "to_status" "WorkOrderStatus" NOT NULL,
    "changed_by" UUID,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    CONSTRAINT "work_order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "work_order_status_history_work_order_id_idx" ON "work_order_status_history"("work_order_id");

ALTER TABLE "work_order_status_history"
ADD CONSTRAINT "work_order_status_history_work_order_id_fkey"
FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_order_status_history"
ADD CONSTRAINT "work_order_status_history_changed_by_fkey"
FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
