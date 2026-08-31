-- Phase 1 Asset Register. Empty table — no backfill from machines/vehicles.
-- Rollback: DROP TABLE "assets"; DROP TYPE "AssetType"; DROP TYPE "AssetStatus"; DROP TYPE "AssetOwnership";

CREATE TYPE "AssetType" AS ENUM ('VEHICLE', 'MACHINE');
CREATE TYPE "AssetStatus" AS ENUM ('REGISTERED', 'ACTIVE', 'IDLE', 'RETIRED', 'DISPOSED');
CREATE TYPE "AssetOwnership" AS ENUM ('COMPANY', 'LEASED', 'EXTERNAL');

CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "type" "AssetType" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'REGISTERED',
    "ownership" "AssetOwnership" NOT NULL,
    "serial_number" VARCHAR(100),
    "location_detail" VARCHAR(255),
    "supplier_id" UUID,
    "acquired_at" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assets_company_id_code_key" ON "assets"("company_id", "code");
CREATE INDEX "assets_company_id_idx" ON "assets"("company_id");
CREATE INDEX "assets_branch_id_idx" ON "assets"("branch_id");
CREATE INDEX "assets_type_idx" ON "assets"("type");
CREATE INDEX "assets_status_idx" ON "assets"("status");
CREATE INDEX "assets_ownership_idx" ON "assets"("ownership");

ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
