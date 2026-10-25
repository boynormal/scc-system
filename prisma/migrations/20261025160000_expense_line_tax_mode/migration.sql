-- Expense lines: per-line VAT mode. Additive; existing rows default to NONE.
-- Rollback: ALTER TABLE "expense_lines" DROP COLUMN "tax_mode";

-- AlterTable
ALTER TABLE "expense_lines" ADD COLUMN "tax_mode" "IncomeTaxMode" NOT NULL DEFAULT 'NONE';

-- Backfill lines whose stored tax already equals 7% of (amount - discount).
-- Old lines always stored net = amount + tax - discount, so only the exclusive
-- mode can reproduce them; other taxed lines stay NONE with their stored tax.
UPDATE "expense_lines"
SET "tax_mode" = 'VAT_EXCLUSIVE'
WHERE "tax_amount" > 0
  AND "tax_amount" = ROUND(GREATEST("amount" - "discount_amount", 0) * 0.07, 2)
  AND "net_amount" = ROUND(GREATEST("amount" - "discount_amount", 0) + "tax_amount", 2);
