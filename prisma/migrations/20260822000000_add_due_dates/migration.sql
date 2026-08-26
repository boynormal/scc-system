-- CreateEnum
CREATE TYPE "DueItemCategory" AS ENUM ('contract', 'license', 'insurance', 'tax', 'certificate', 'other');

-- CreateEnum
CREATE TYPE "DueItemRecurrence" AS ENUM ('none', 'monthly', 'yearly');

-- CreateEnum
CREATE TYPE "DueItemStatus" AS ENUM ('open', 'closed', 'cancelled');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'due_item_upcoming';
ALTER TYPE "NotificationType" ADD VALUE 'due_item_overdue';

-- CreateTable
CREATE TABLE "due_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" "DueItemCategory" NOT NULL,
    "due_date" DATE NOT NULL,
    "lead_time_days" SMALLINT NOT NULL DEFAULT 14,
    "recurrence" "DueItemRecurrence" NOT NULL DEFAULT 'none',
    "status" "DueItemStatus" NOT NULL DEFAULT 'open',
    "owner_user_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "due_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "due_item_renewals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "item_id" UUID NOT NULL,
    "previous_due_date" DATE NOT NULL,
    "new_due_date" DATE NOT NULL,
    "renewed_by_id" UUID NOT NULL,
    "renewed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "due_item_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "due_items_company_id_idx" ON "due_items"("company_id");
CREATE INDEX "due_items_branch_id_idx" ON "due_items"("branch_id");
CREATE INDEX "due_items_due_date_status_idx" ON "due_items"("due_date", "status");
CREATE INDEX "due_items_owner_user_id_idx" ON "due_items"("owner_user_id");
CREATE INDEX "due_item_renewals_item_id_idx" ON "due_item_renewals"("item_id");

-- AddForeignKey
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "due_items" ADD CONSTRAINT "due_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "due_item_renewals" ADD CONSTRAINT "due_item_renewals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "due_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "due_item_renewals" ADD CONSTRAINT "due_item_renewals_renewed_by_id_fkey" FOREIGN KEY ("renewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
