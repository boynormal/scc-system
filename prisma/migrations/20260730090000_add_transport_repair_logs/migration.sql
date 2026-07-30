-- CreateEnum
CREATE TYPE "TransportRepairStatus" AS ENUM ('reported', 'in_repair', 'closed', 'cancelled');

-- CreateTable
CREATE TABLE "transport_repair_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "symptom" TEXT NOT NULL,
    "notes" TEXT,
    "status" "TransportRepairStatus" NOT NULL DEFAULT 'reported',
    "reported_by_id" UUID NOT NULL,
    "reported_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by_id" UUID,
    "started_at" TIMESTAMPTZ,
    "closed_by_id" UUID,
    "closed_at" TIMESTAMPTZ,
    "mileage_at_report" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transport_repair_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transport_repair_logs_company_id_idx" ON "transport_repair_logs"("company_id");
CREATE INDEX "transport_repair_logs_branch_id_idx" ON "transport_repair_logs"("branch_id");
CREATE INDEX "transport_repair_logs_vehicle_id_idx" ON "transport_repair_logs"("vehicle_id");
CREATE INDEX "transport_repair_logs_status_idx" ON "transport_repair_logs"("status");
CREATE INDEX "transport_repair_logs_vehicle_id_status_idx" ON "transport_repair_logs"("vehicle_id", "status");

-- AddForeignKey
ALTER TABLE "transport_repair_logs" ADD CONSTRAINT "transport_repair_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_repair_logs" ADD CONSTRAINT "transport_repair_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_repair_logs" ADD CONSTRAINT "transport_repair_logs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "transport_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_repair_logs" ADD CONSTRAINT "transport_repair_logs_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transport_repair_logs" ADD CONSTRAINT "transport_repair_logs_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transport_repair_logs" ADD CONSTRAINT "transport_repair_logs_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
