-- Fuel management: per-branch tanks, append-only ledger, moving-average cost.
-- Rollback: DROP TABLE fuel_transactions, fuel_tanks, fuel_types; DROP TYPE "FuelTxnType", "FuelTargetType", "FuelMeterType".

-- CreateEnum
CREATE TYPE "FuelTxnType" AS ENUM ('RECEIVE', 'DISPENSE', 'ADJUST', 'TRANSFER_OUT', 'TRANSFER_IN', 'REVERSAL');

-- CreateEnum
CREATE TYPE "FuelTargetType" AS ENUM ('ASSET', 'OTHER');

-- CreateEnum
CREATE TYPE "FuelMeterType" AS ENUM ('ODOMETER', 'HOUR_METER', 'NONE');

-- CreateTable
CREATE TABLE "fuel_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "unit" VARCHAR(20) NOT NULL DEFAULT 'ลิตร',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "fuel_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_tanks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "fuel_type_id" UUID NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "capacity" DECIMAL(12,2) NOT NULL,
    "min_level" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "current_qty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avg_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "fuel_tanks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fuel_tanks_capacity_check" CHECK ("capacity" > 0),
    CONSTRAINT "fuel_tanks_current_qty_check" CHECK ("current_qty" >= 0)
);

-- CreateTable
CREATE TABLE "fuel_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "tank_id" UUID NOT NULL,
    "type" "FuelTxnType" NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unit_cost" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance_after" DECIMAL(12,2) NOT NULL,
    "avg_cost_after" DECIMAL(12,4) NOT NULL,
    "supplier_id" UUID,
    "document_no" VARCHAR(50),
    "target_type" "FuelTargetType",
    "asset_id" UUID,
    "other_target_name" VARCHAR(255),
    "other_target_note" TEXT,
    "meter_type" "FuelMeterType" NOT NULL DEFAULT 'NONE',
    "meter_reading" DECIMAL(14,2),
    "receiver_name" VARCHAR(255),
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remark" TEXT,
    "reversal_of_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fuel_transactions_quantity_check" CHECK ("quantity" <> 0),
    CONSTRAINT "fuel_transactions_balance_check" CHECK ("balance_after" >= 0),
    CONSTRAINT "fuel_transactions_dispense_target_check" CHECK (
        "type" <> 'DISPENSE'
        OR ("target_type" = 'ASSET' AND "asset_id" IS NOT NULL)
        OR ("target_type" = 'OTHER' AND "other_target_name" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "fuel_types_company_id_idx" ON "fuel_types"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_types_company_id_code_key" ON "fuel_types"("company_id", "code");

-- CreateIndex
CREATE INDEX "fuel_tanks_company_id_idx" ON "fuel_tanks"("company_id");

-- CreateIndex
CREATE INDEX "fuel_tanks_branch_id_idx" ON "fuel_tanks"("branch_id");

-- CreateIndex
CREATE INDEX "fuel_tanks_fuel_type_id_idx" ON "fuel_tanks"("fuel_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_tanks_company_id_code_key" ON "fuel_tanks"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "fuel_transactions_reversal_of_id_key" ON "fuel_transactions"("reversal_of_id");

-- CreateIndex
CREATE INDEX "fuel_transactions_company_id_idx" ON "fuel_transactions"("company_id");

-- CreateIndex
CREATE INDEX "fuel_transactions_tank_id_occurred_at_idx" ON "fuel_transactions"("tank_id", "occurred_at");

-- CreateIndex
CREATE INDEX "fuel_transactions_asset_id_occurred_at_idx" ON "fuel_transactions"("asset_id", "occurred_at");

-- CreateIndex
CREATE INDEX "fuel_transactions_branch_id_occurred_at_idx" ON "fuel_transactions"("branch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "fuel_transactions_type_idx" ON "fuel_transactions"("type");

-- AddForeignKey
ALTER TABLE "fuel_types" ADD CONSTRAINT "fuel_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_tanks" ADD CONSTRAINT "fuel_tanks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_tanks" ADD CONSTRAINT "fuel_tanks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_tanks" ADD CONSTRAINT "fuel_tanks_fuel_type_id_fkey" FOREIGN KEY ("fuel_type_id") REFERENCES "fuel_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_tank_id_fkey" FOREIGN KEY ("tank_id") REFERENCES "fuel_tanks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "fuel_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
