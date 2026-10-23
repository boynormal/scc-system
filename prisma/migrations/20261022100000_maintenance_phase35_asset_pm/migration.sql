-- Phase 3.5: PM targets come from the asset register. Expand only; existing machine rows keep working.

ALTER TABLE "assets" ADD COLUMN "maintenance_pm_enabled" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "assets_company_id_maintenance_pm_enabled_idx" ON "assets"("company_id", "maintenance_pm_enabled");

ALTER TABLE "machines" ADD COLUMN "asset_id" UUID;
CREATE UNIQUE INDEX "machines_asset_id_key" ON "machines"("asset_id");
ALTER TABLE "machines"
ADD CONSTRAINT "machines_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transport_vehicles" ADD COLUMN "asset_id" UUID;
CREATE UNIQUE INDEX "transport_vehicles_asset_id_key" ON "transport_vehicles"("asset_id");
ALTER TABLE "transport_vehicles"
ADD CONSTRAINT "transport_vehicles_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "maintenance_plans" ADD COLUMN "asset_id" UUID;
ALTER TABLE "maintenance_plans" ALTER COLUMN "machine_id" DROP NOT NULL;
CREATE INDEX "maintenance_plans_asset_id_idx" ON "maintenance_plans"("asset_id");
ALTER TABLE "maintenance_plans"
ADD CONSTRAINT "maintenance_plans_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_plans"
ADD CONSTRAINT "maintenance_plans_target_check" CHECK ("machine_id" IS NOT NULL OR "asset_id" IS NOT NULL);

ALTER TABLE "maintenance_schedules" ADD COLUMN "asset_id" UUID;
ALTER TABLE "maintenance_schedules" ALTER COLUMN "machine_id" DROP NOT NULL;
CREATE INDEX "maintenance_schedules_asset_id_idx" ON "maintenance_schedules"("asset_id");
ALTER TABLE "maintenance_schedules"
ADD CONSTRAINT "maintenance_schedules_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_schedules"
ADD CONSTRAINT "maintenance_schedules_target_check" CHECK ("machine_id" IS NOT NULL OR "asset_id" IS NOT NULL);

ALTER TABLE "work_orders" ADD COLUMN "asset_id" UUID;
ALTER TABLE "work_orders" ALTER COLUMN "machine_id" DROP NOT NULL;
CREATE INDEX "work_orders_asset_id_status_idx" ON "work_orders"("asset_id", "status");
ALTER TABLE "work_orders"
ADD CONSTRAINT "work_orders_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "work_orders"
ADD CONSTRAINT "work_orders_target_check" CHECK ("machine_id" IS NOT NULL OR "asset_id" IS NOT NULL);
