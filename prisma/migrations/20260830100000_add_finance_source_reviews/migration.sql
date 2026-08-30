-- Finance review queue: persist PENDING / EXPENSE_CREATED / NO_EXPENSE
-- for operational sources. Missing row = PENDING. No backfill.

CREATE TYPE "FinanceSourceReviewStatus" AS ENUM ('PENDING', 'EXPENSE_CREATED', 'NO_EXPENSE');

CREATE TABLE "finance_source_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "source_module" "ExpenseSourceModule" NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_document_id" VARCHAR(64) NOT NULL,
    "source_line_id" VARCHAR(64),
    "status" "FinanceSourceReviewStatus" NOT NULL,
    "reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_source_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_source_reviews_company_id_idx" ON "finance_source_reviews"("company_id");
CREATE INDEX "finance_source_reviews_lookup_idx" ON "finance_source_reviews"("company_id", "source_module", "source_type", "source_document_id");
CREATE INDEX "finance_source_reviews_status_idx" ON "finance_source_reviews"("status");

-- One review per document when there is no child line (jobs / repair / tire today)
CREATE UNIQUE INDEX "finance_source_reviews_doc_uniq" ON "finance_source_reviews" (
    "company_id", "source_module", "source_type", "source_document_id"
) WHERE "source_line_id" IS NULL;

-- One review per child line (future multi-line sources)
CREATE UNIQUE INDEX "finance_source_reviews_line_uniq" ON "finance_source_reviews" (
    "company_id", "source_module", "source_type", "source_document_id", "source_line_id"
) WHERE "source_line_id" IS NOT NULL;

ALTER TABLE "finance_source_reviews" ADD CONSTRAINT "finance_source_reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_source_reviews" ADD CONSTRAINT "finance_source_reviews_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
