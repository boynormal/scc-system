-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TransportPaymentMethod" AS ENUM ('cash', 'credit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "transport_tire_logs" ADD COLUMN IF NOT EXISTS "payment_method" "TransportPaymentMethod";
ALTER TABLE "transport_repair_logs" ADD COLUMN IF NOT EXISTS "payment_method" "TransportPaymentMethod";
