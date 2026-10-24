-- Income bills: per-bill VAT mode. Additive; existing rows default to NONE.
-- Rollback: ALTER TABLE "incomes" DROP COLUMN "tax_mode"; DROP TYPE "IncomeTaxMode";

-- CreateEnum
CREATE TYPE "IncomeTaxMode" AS ENUM ('NONE', 'VAT_EXCLUSIVE', 'VAT_INCLUSIVE');

-- AlterTable
ALTER TABLE "incomes" ADD COLUMN "tax_mode" "IncomeTaxMode" NOT NULL DEFAULT 'NONE';
