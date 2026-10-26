-- Finance: remove the process dimension from expense and income lines.
-- Destructive: process names and the type-to-process mapping are dropped.
-- Rollback: re-run 20260828020000_add_expense_master_taxonomy (processes part),
-- 20260829090000_add_expense_line_process_and_unit (process_id), and the
-- income_lines process_id part of 20261024130000_add_finance_income.

-- DropForeignKey
ALTER TABLE "expense_lines" DROP CONSTRAINT IF EXISTS "expense_lines_process_id_fkey";
ALTER TABLE "income_lines" DROP CONSTRAINT IF EXISTS "income_lines_process_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "expense_lines_process_id_idx";
DROP INDEX IF EXISTS "income_lines_process_id_idx";

-- AlterTable
ALTER TABLE "expense_lines" DROP COLUMN IF EXISTS "process_id";
ALTER TABLE "income_lines" DROP COLUMN IF EXISTS "process_id";
ALTER TABLE "expense_types" DROP COLUMN IF EXISTS "requires_process";

-- DropTable
DROP TABLE IF EXISTS "expense_type_processes";
DROP TABLE IF EXISTS "processes";
