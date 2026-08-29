-- Finance: convert flat expenses into header + ExpenseLine (multi-line bills).
-- Adds posting_date, splits source linking down to the line, and separates
-- manual bills (no source) from module-linked lines.

-- CreateEnum
CREATE TYPE "ExpenseSourceKind" AS ENUM ('MANUAL', 'MODULE', 'IMPORT');

-- CreateEnum
CREATE TYPE "ExpenseLinePricingMode" AS ENUM ('QTY_PRICE', 'AMOUNT');

-- ─── Rework ExpenseSourceModule: drop MANUAL/OTHER, make column nullable ──────
ALTER TABLE "expenses" ALTER COLUMN "source_module" DROP DEFAULT;
ALTER TABLE "expenses" ALTER COLUMN "source_module" DROP NOT NULL;

CREATE TYPE "ExpenseSourceModule_new" AS ENUM ('TRANSPORT', 'MAINTENANCE', 'INVENTORY', 'HR');

ALTER TABLE "expenses"
  ALTER COLUMN "source_module" TYPE "ExpenseSourceModule_new"
  USING (
    CASE
      WHEN "source_module"::text IN ('MANUAL', 'OTHER') THEN NULL
      ELSE "source_module"::text::"ExpenseSourceModule_new"
    END
  );

DROP TYPE "ExpenseSourceModule";
ALTER TYPE "ExpenseSourceModule_new" RENAME TO "ExpenseSourceModule";

-- ─── Header: posting_date (defaults to expense date for existing rows) ────────
ALTER TABLE "expenses" ADD COLUMN "posting_date" DATE;
UPDATE "expenses" SET "posting_date" = "expense_date";

-- ─── ExpenseLine table ────────────────────────────────────────────────────────
CREATE TABLE "expense_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "expense_type_id" UUID NOT NULL,
    "description" TEXT,
    "pricing_mode" "ExpenseLinePricingMode" NOT NULL DEFAULT 'AMOUNT',
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_code" VARCHAR(30),
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost_center_id" UUID,
    "cost_object_type" "ExpenseCostObjectType",
    "cost_object_id" VARCHAR(64),
    "cost_object_label" VARCHAR(255),
    "source_kind" "ExpenseSourceKind" NOT NULL DEFAULT 'MANUAL',
    "source_module" "ExpenseSourceModule",
    "source_type" VARCHAR(50),
    "source_document_id" VARCHAR(64),
    "source_line_id" VARCHAR(64),
    "source_link_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_lines_pkey" PRIMARY KEY ("id")
);

-- ─── Backfill: one line per existing expense ─────────────────────────────────
INSERT INTO "expense_lines" (
    "id", "company_id", "expense_id", "line_no", "expense_type_id", "description",
    "pricing_mode", "quantity", "unit_code", "unit_price",
    "amount", "tax_amount", "discount_amount", "net_amount",
    "cost_center_id", "cost_object_type", "cost_object_id", "cost_object_label",
    "source_kind", "source_module", "source_type", "source_document_id", "source_line_id",
    "source_link_active", "created_at", "updated_at"
)
SELECT
    gen_random_uuid(), e."company_id", e."id", 1, e."expense_type_id", e."description",
    'AMOUNT', 1, NULL, e."amount",
    e."amount", e."tax_amount", e."discount_amount", e."net_amount",
    e."cost_center_id", e."cost_object_type", e."cost_object_id", e."cost_object_label",
    CASE WHEN e."source_module" IS NULL THEN 'MANUAL'::"ExpenseSourceKind" ELSE 'IMPORT'::"ExpenseSourceKind" END,
    e."source_module", e."source_type",
    CASE WHEN e."source_module" IS NULL THEN NULL ELSE e."source_id" END,
    NULL,
    CASE WHEN e."deleted_at" IS NULL AND e."status" <> 'CANCELLED' THEN true ELSE false END,
    e."created_at", CURRENT_TIMESTAMP
FROM "expenses" e;

-- CreateIndex
CREATE INDEX "expense_lines_expense_id_idx" ON "expense_lines"("expense_id");
CREATE INDEX "expense_lines_company_id_idx" ON "expense_lines"("company_id");
CREATE INDEX "expense_lines_expense_type_id_idx" ON "expense_lines"("expense_type_id");
CREATE INDEX "expense_lines_cost_center_id_idx" ON "expense_lines"("cost_center_id");
CREATE INDEX "expense_lines_source_module_source_document_id_idx" ON "expense_lines"("source_module", "source_document_id");

-- Partial unique: one linked line per source document when there is no child line
CREATE UNIQUE INDEX "expense_lines_source_doc_uniq" ON "expense_lines" (
    "company_id", "source_module", "source_type", "source_document_id"
) WHERE "source_link_active" AND "source_document_id" IS NOT NULL AND "source_line_id" IS NULL;

-- Partial unique: one linked line per source child line (future multi-line docs)
CREATE UNIQUE INDEX "expense_lines_source_line_uniq" ON "expense_lines" (
    "company_id", "source_module", "source_type", "source_document_id", "source_line_id"
) WHERE "source_link_active" AND "source_document_id" IS NOT NULL AND "source_line_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_expense_type_id_fkey" FOREIGN KEY ("expense_type_id") REFERENCES "expense_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_lines" ADD CONSTRAINT "expense_lines_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
