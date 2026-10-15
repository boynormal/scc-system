-- Asset register: free-text details replaces location and the supplier link.
-- Existing location text is kept. Supplier selections are not copied.
-- Rollback: ALTER TABLE "assets" RENAME COLUMN "details" TO "location_detail";
--   ALTER TABLE "assets" ALTER COLUMN "location_detail" TYPE VARCHAR(255);
--   ALTER TABLE "assets" ADD COLUMN "supplier_id" UUID;
--   ALTER TABLE "assets" ADD CONSTRAINT "assets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_supplier_id_fkey";
ALTER TABLE "assets" DROP COLUMN IF EXISTS "supplier_id";
ALTER TABLE "assets" RENAME COLUMN "location_detail" TO "details";
ALTER TABLE "assets" ALTER COLUMN "details" TYPE TEXT;
