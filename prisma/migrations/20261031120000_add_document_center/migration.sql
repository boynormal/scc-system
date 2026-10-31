-- Document Center metadata. File bytes stay in SeaweedFS via stored_files.
-- Additive only: no existing table or column changes.
-- Rollback: DROP TABLE doc_center_access_logs, doc_center_favorites, doc_center_versions,
-- doc_center_documents, doc_center_types, doc_center_categories;
-- then DROP TYPE "DocCenterAccessAction", "DocCenterStatus".

CREATE TYPE "DocCenterStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "DocCenterAccessAction" AS ENUM ('VIEW', 'DOWNLOAD');

CREATE TABLE "doc_center_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(20),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "doc_center_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_center_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "doc_center_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_center_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "document_code" VARCHAR(50) NOT NULL,
    "document_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "type_id" UUID NOT NULL,
    "branch_id" UUID,
    "department_id" UUID,
    "status" "DocCenterStatus" NOT NULL DEFAULT 'ACTIVE',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "current_version_id" UUID,
    "effective_date" DATE,
    "expiry_date" DATE,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    CONSTRAINT "doc_center_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_center_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "stored_file_id" UUID NOT NULL,
    "change_note" TEXT,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_center_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "doc_center_favorites" (
    "user_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_center_favorites_pkey" PRIMARY KEY ("user_id", "document_id")
);

CREATE TABLE "doc_center_access_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "version_id" UUID,
    "user_id" UUID NOT NULL,
    "action" "DocCenterAccessAction" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doc_center_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "doc_center_categories_company_id_parent_id_name_key" ON "doc_center_categories"("company_id", "parent_id", "name");
CREATE INDEX "doc_center_categories_company_id_idx" ON "doc_center_categories"("company_id");
CREATE INDEX "doc_center_categories_parent_id_idx" ON "doc_center_categories"("parent_id");

CREATE UNIQUE INDEX "doc_center_types_company_id_code_key" ON "doc_center_types"("company_id", "code");
CREATE INDEX "doc_center_types_company_id_idx" ON "doc_center_types"("company_id");

CREATE UNIQUE INDEX "doc_center_documents_company_id_document_code_key" ON "doc_center_documents"("company_id", "document_code");
CREATE UNIQUE INDEX "doc_center_documents_current_version_id_key" ON "doc_center_documents"("current_version_id");
CREATE INDEX "doc_center_documents_company_id_idx" ON "doc_center_documents"("company_id");
CREATE INDEX "doc_center_documents_category_id_idx" ON "doc_center_documents"("category_id");
CREATE INDEX "doc_center_documents_type_id_idx" ON "doc_center_documents"("type_id");
CREATE INDEX "doc_center_documents_branch_id_idx" ON "doc_center_documents"("branch_id");
CREATE INDEX "doc_center_documents_department_id_idx" ON "doc_center_documents"("department_id");
CREATE INDEX "doc_center_documents_status_idx" ON "doc_center_documents"("status");
CREATE INDEX "doc_center_documents_created_at_idx" ON "doc_center_documents"("created_at");
CREATE INDEX "doc_center_documents_updated_at_idx" ON "doc_center_documents"("updated_at");
CREATE INDEX "doc_center_documents_tags_idx" ON "doc_center_documents" USING GIN ("tags");

CREATE UNIQUE INDEX "doc_center_versions_stored_file_id_key" ON "doc_center_versions"("stored_file_id");
CREATE UNIQUE INDEX "doc_center_versions_document_id_version_number_key" ON "doc_center_versions"("document_id", "version_number");
CREATE INDEX "doc_center_versions_document_id_idx" ON "doc_center_versions"("document_id");

CREATE INDEX "doc_center_favorites_document_id_idx" ON "doc_center_favorites"("document_id");
CREATE INDEX "doc_center_access_logs_document_id_created_at_idx" ON "doc_center_access_logs"("document_id", "created_at");
CREATE INDEX "doc_center_access_logs_user_id_created_at_idx" ON "doc_center_access_logs"("user_id", "created_at");

ALTER TABLE "doc_center_categories" ADD CONSTRAINT "doc_center_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_categories" ADD CONSTRAINT "doc_center_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "doc_center_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_types" ADD CONSTRAINT "doc_center_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "doc_center_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "doc_center_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_versions" ADD CONSTRAINT "doc_center_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "doc_center_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_versions" ADD CONSTRAINT "doc_center_versions_stored_file_id_fkey" FOREIGN KEY ("stored_file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_versions" ADD CONSTRAINT "doc_center_versions_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_documents" ADD CONSTRAINT "doc_center_documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "doc_center_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doc_center_favorites" ADD CONSTRAINT "doc_center_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_favorites" ADD CONSTRAINT "doc_center_favorites_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "doc_center_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "doc_center_access_logs" ADD CONSTRAINT "doc_center_access_logs_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "doc_center_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doc_center_access_logs" ADD CONSTRAINT "doc_center_access_logs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "doc_center_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "doc_center_access_logs" ADD CONSTRAINT "doc_center_access_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
