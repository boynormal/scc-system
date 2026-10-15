-- Asset type becomes a per-company master. Existing VEHICLE/MACHINE rows become ยานพาหนะ/เครื่องจักร.
-- Rollback is not automatic: restoring the enum would need the old type column back.

CREATE TABLE "asset_register_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_register_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_register_types_company_id_name_key" ON "asset_register_types"("company_id", "name");
CREATE INDEX "asset_register_types_company_id_idx" ON "asset_register_types"("company_id");

ALTER TABLE "asset_register_types" ADD CONSTRAINT "asset_register_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "asset_register_types" ("company_id", "name", "sort_order", "updated_at")
SELECT "id", 'ยานพาหนะ', 0, CURRENT_TIMESTAMP FROM "companies";

INSERT INTO "asset_register_types" ("company_id", "name", "sort_order", "updated_at")
SELECT "id", 'เครื่องจักร', 1, CURRENT_TIMESTAMP FROM "companies";

ALTER TABLE "assets" ADD COLUMN "type_id" UUID;

UPDATE "assets" AS a
SET "type_id" = t."id"
FROM "asset_register_types" AS t
WHERE t."company_id" = a."company_id"
  AND (
    (a."type"::text = 'VEHICLE' AND t."name" = 'ยานพาหนะ')
    OR (a."type"::text = 'MACHINE' AND t."name" = 'เครื่องจักร')
  );

ALTER TABLE "assets" ALTER COLUMN "type_id" SET NOT NULL;

DROP INDEX IF EXISTS "assets_type_idx";
ALTER TABLE "assets" DROP COLUMN "type";
DROP TYPE "AssetType";

CREATE INDEX "assets_type_id_idx" ON "assets"("type_id");
ALTER TABLE "assets" ADD CONSTRAINT "assets_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "asset_register_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
