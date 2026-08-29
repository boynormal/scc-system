-- Expense Phase 4: line-level process + shared Unit FK, LOCATION cost object.
-- Additive only. Existing expense_lines remain valid (new columns nullable).

ALTER TYPE "ExpenseCostObjectType" ADD VALUE 'LOCATION';

ALTER TABLE "expense_lines" ADD COLUMN "process_id" UUID,
ADD COLUMN "unit_id" UUID;

CREATE INDEX "expense_lines_process_id_idx" ON "expense_lines"("process_id");
CREATE INDEX "expense_lines_unit_id_idx" ON "expense_lines"("unit_id");

ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
