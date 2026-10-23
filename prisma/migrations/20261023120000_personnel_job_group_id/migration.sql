-- Job groups (for Man Hour), separate from departments. Additive only: existing personnel.job_group text is untouched.
-- Rollback: ALTER TABLE "personnel" DROP CONSTRAINT "personnel_job_group_id_fkey"; DROP INDEX "personnel_job_group_id_idx"; ALTER TABLE "personnel" DROP COLUMN "job_group_id"; DROP TABLE "job_groups";

CREATE TABLE "job_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" VARCHAR(20),
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_groups_company_id_name_key" ON "job_groups"("company_id", "name");

CREATE INDEX "job_groups_company_id_idx" ON "job_groups"("company_id");

ALTER TABLE "job_groups" ADD CONSTRAINT "job_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "personnel" ADD COLUMN "job_group_id" UUID;

CREATE INDEX "personnel_job_group_id_idx" ON "personnel"("job_group_id");

ALTER TABLE "personnel" ADD CONSTRAINT "personnel_job_group_id_fkey" FOREIGN KEY ("job_group_id") REFERENCES "job_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
