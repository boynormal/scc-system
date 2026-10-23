-- Repair work orders may target an asset or nothing (general repair, branch only).
-- Plans and schedules still require machine_id or asset_id.
ALTER TABLE "work_orders" DROP CONSTRAINT IF EXISTS "work_orders_target_check";
