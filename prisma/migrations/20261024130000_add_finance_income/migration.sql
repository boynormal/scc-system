-- Finance income bills: header + lines + attachments + own category/type masters.
-- Additive only: no existing table or column changes.
-- Rollback: DROP TABLE income_attachments, income_lines, incomes, income_types,
-- income_categories (in that order), then DROP TYPE "IncomeStatus".

-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'RECEIVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "income_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "income_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "category_id" UUID,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "income_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incomes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "income_no" VARCHAR(30) NOT NULL,
    "income_date" DATE NOT NULL,
    "posting_date" DATE,
    "payer_name" VARCHAR(255) NOT NULL,
    "employee_id" UUID,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'THB',
    "notes" TEXT,
    "status" "IncomeStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_method" "TransportPaymentMethod",
    "received_at" TIMESTAMPTZ,
    "received_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "income_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "income_type_id" UUID NOT NULL,
    "description" TEXT,
    "pricing_mode" "ExpenseLinePricingMode" NOT NULL DEFAULT 'AMOUNT',
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "unit_id" UUID,
    "unit_code" VARCHAR(30),
    "unit_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost_center_id" UUID,
    "process_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "income_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "income_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" VARCHAR(255),
    "file_size" INTEGER,
    "uploaded_by" UUID,
    "stored_file_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "income_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "income_categories_company_id_idx" ON "income_categories"("company_id");
CREATE INDEX "income_categories_parent_id_idx" ON "income_categories"("parent_id");
CREATE UNIQUE INDEX "income_categories_company_id_code_key" ON "income_categories"("company_id", "code");
CREATE INDEX "income_types_company_id_idx" ON "income_types"("company_id");
CREATE INDEX "income_types_category_id_idx" ON "income_types"("category_id");
CREATE UNIQUE INDEX "income_types_company_id_code_key" ON "income_types"("company_id", "code");
CREATE INDEX "incomes_company_id_idx" ON "incomes"("company_id");
CREATE INDEX "incomes_branch_id_idx" ON "incomes"("branch_id");
CREATE INDEX "incomes_income_date_idx" ON "incomes"("income_date");
CREATE INDEX "incomes_status_idx" ON "incomes"("status");
CREATE UNIQUE INDEX "incomes_company_id_income_no_key" ON "incomes"("company_id", "income_no");
CREATE INDEX "income_lines_income_id_idx" ON "income_lines"("income_id");
CREATE INDEX "income_lines_company_id_idx" ON "income_lines"("company_id");
CREATE INDEX "income_lines_income_type_id_idx" ON "income_lines"("income_type_id");
CREATE INDEX "income_lines_cost_center_id_idx" ON "income_lines"("cost_center_id");
CREATE INDEX "income_lines_process_id_idx" ON "income_lines"("process_id");
CREATE INDEX "income_lines_unit_id_idx" ON "income_lines"("unit_id");
CREATE UNIQUE INDEX "income_attachments_stored_file_id_key" ON "income_attachments"("stored_file_id");
CREATE INDEX "income_attachments_income_id_idx" ON "income_attachments"("income_id");

-- AddForeignKey
ALTER TABLE "income_categories" ADD CONSTRAINT "income_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "income_categories" ADD CONSTRAINT "income_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "income_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "income_types" ADD CONSTRAINT "income_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "income_types" ADD CONSTRAINT "income_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "income_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "income_lines" ADD CONSTRAINT "income_lines_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "incomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "income_lines" ADD CONSTRAINT "income_lines_income_type_id_fkey" FOREIGN KEY ("income_type_id") REFERENCES "income_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "income_lines" ADD CONSTRAINT "income_lines_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "income_lines" ADD CONSTRAINT "income_lines_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "income_lines" ADD CONSTRAINT "income_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "income_attachments" ADD CONSTRAINT "income_attachments_income_id_fkey" FOREIGN KEY ("income_id") REFERENCES "incomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "income_attachments" ADD CONSTRAINT "income_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "income_attachments" ADD CONSTRAINT "income_attachments_stored_file_id_fkey" FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
