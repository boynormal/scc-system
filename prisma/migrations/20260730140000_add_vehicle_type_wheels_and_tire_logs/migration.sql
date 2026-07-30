-- AlterTable: vehicle type wheel fields
ALTER TABLE "transport_vehicle_types" ADD COLUMN IF NOT EXISTS "wheel_count" INTEGER;
ALTER TABLE "transport_vehicle_types" ADD COLUMN IF NOT EXISTS "wheel_layout" JSONB;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TransportTireWorkType" AS ENUM ('change', 'patch', 'repair');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "transport_tire_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "work_date" TIMESTAMPTZ NOT NULL,
    "wheel_position" INTEGER NOT NULL,
    "work_type" "TransportTireWorkType" NOT NULL,
    "cost" DECIMAL(12,2),
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transport_tire_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "transport_tire_logs_company_id_idx" ON "transport_tire_logs"("company_id");
CREATE INDEX IF NOT EXISTS "transport_tire_logs_branch_id_idx" ON "transport_tire_logs"("branch_id");
CREATE INDEX IF NOT EXISTS "transport_tire_logs_vehicle_id_idx" ON "transport_tire_logs"("vehicle_id");
CREATE INDEX IF NOT EXISTS "transport_tire_logs_work_date_idx" ON "transport_tire_logs"("work_date");
CREATE INDEX IF NOT EXISTS "transport_tire_logs_vehicle_id_work_date_idx" ON "transport_tire_logs"("vehicle_id", "work_date");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "transport_tire_logs" ADD CONSTRAINT "transport_tire_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "transport_tire_logs" ADD CONSTRAINT "transport_tire_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "transport_tire_logs" ADD CONSTRAINT "transport_tire_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "transport_tire_logs" ADD CONSTRAINT "transport_tire_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
