-- Supplier notes shown on the partners page. Rollback: ALTER TABLE "suppliers" DROP COLUMN "details";

ALTER TABLE "suppliers" ADD COLUMN "details" TEXT;
