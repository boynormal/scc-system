-- AlterTable
ALTER TABLE "transport_repair_logs" ADD COLUMN IF NOT EXISTS "repair_cost" DECIMAL(12,2);
