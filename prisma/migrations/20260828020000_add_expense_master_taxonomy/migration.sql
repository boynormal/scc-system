-- Expense Master taxonomy (Phase 1-2): categories, processes, cost classification,
-- required-dimension metadata, and cost-center/process mappings.
-- Fully additive: new tables + nullable/defaulted columns only. Existing
-- ExpenseType / Expense / ExpenseLine data and legacy codes remain valid.

-- CreateEnum
CREATE TYPE "ExpenseCostType" AS ENUM ('FIXED', 'VARIABLE', 'MIXED');

-- CreateEnum
CREATE TYPE "ExpenseDirectness" AS ENUM ('DIRECT', 'INDIRECT');

-- AlterTable
ALTER TABLE "expense_types" ADD COLUMN     "category_id" UUID,
ADD COLUMN     "default_cost_type" "ExpenseCostType",
ADD COLUMN     "default_directness" "ExpenseDirectness",
ADD COLUMN     "default_gl_label" VARCHAR(255),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "requires_cost_center" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_location" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_machine" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_process" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_vehicle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_vendor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subcategory" VARCHAR(255);

-- CreateTable
CREATE TABLE "expense_categories" (
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

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_type_cost_centers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "expense_type_id" UUID NOT NULL,
    "cost_center_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_type_cost_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_type_processes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "expense_type_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_allowed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "expense_type_processes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_categories_company_id_idx" ON "expense_categories"("company_id");

-- CreateIndex
CREATE INDEX "expense_categories_parent_id_idx" ON "expense_categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_company_id_code_key" ON "expense_categories"("company_id", "code");

-- CreateIndex
CREATE INDEX "processes_company_id_idx" ON "processes"("company_id");

-- CreateIndex
CREATE INDEX "processes_parent_id_idx" ON "processes"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "processes_company_id_code_key" ON "processes"("company_id", "code");

-- CreateIndex
CREATE INDEX "expense_type_cost_centers_company_id_idx" ON "expense_type_cost_centers"("company_id");

-- CreateIndex
CREATE INDEX "expense_type_cost_centers_expense_type_id_idx" ON "expense_type_cost_centers"("expense_type_id");

-- CreateIndex
CREATE INDEX "expense_type_cost_centers_cost_center_id_idx" ON "expense_type_cost_centers"("cost_center_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_type_cost_centers_expense_type_id_cost_center_id_key" ON "expense_type_cost_centers"("expense_type_id", "cost_center_id");

-- CreateIndex
CREATE INDEX "expense_type_processes_company_id_idx" ON "expense_type_processes"("company_id");

-- CreateIndex
CREATE INDEX "expense_type_processes_expense_type_id_idx" ON "expense_type_processes"("expense_type_id");

-- CreateIndex
CREATE INDEX "expense_type_processes_process_id_idx" ON "expense_type_processes"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_type_processes_expense_type_id_process_id_key" ON "expense_type_processes"("expense_type_id", "process_id");

-- CreateIndex
CREATE INDEX "expense_types_category_id_idx" ON "expense_types"("category_id");

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processes" ADD CONSTRAINT "processes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "processes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_types" ADD CONSTRAINT "expense_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_type_cost_centers" ADD CONSTRAINT "expense_type_cost_centers_expense_type_id_fkey" FOREIGN KEY ("expense_type_id") REFERENCES "expense_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_type_cost_centers" ADD CONSTRAINT "expense_type_cost_centers_cost_center_id_fkey" FOREIGN KEY ("cost_center_id") REFERENCES "cost_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_type_processes" ADD CONSTRAINT "expense_type_processes_expense_type_id_fkey" FOREIGN KEY ("expense_type_id") REFERENCES "expense_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_type_processes" ADD CONSTRAINT "expense_type_processes_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
