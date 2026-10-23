-- Meter type recorded when fuel is dispensed to an asset.
-- Rollback: ALTER TABLE "assets" DROP COLUMN "fuel_meter_type";

-- AlterTable
ALTER TABLE "assets" ADD COLUMN "fuel_meter_type" "FuelMeterType" NOT NULL DEFAULT 'NONE';
