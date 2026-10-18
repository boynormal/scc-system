-- One counted branch per person per day. No row means the home branch.
-- Rollback: DROP TABLE attendance_day_branches;

CREATE TABLE "attendance_day_branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "branch_id" UUID NOT NULL,
    "decided_by_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_day_branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_day_branches_person_date_unique" ON "attendance_day_branches"("personnel_id", "work_date");
CREATE INDEX "attendance_day_branches_company_id_work_date_branch_id_idx" ON "attendance_day_branches"("company_id", "work_date", "branch_id");

ALTER TABLE "attendance_day_branches" ADD CONSTRAINT "attendance_day_branches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_day_branches" ADD CONSTRAINT "attendance_day_branches_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_day_branches" ADD CONSTRAINT "attendance_day_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_day_branches" ADD CONSTRAINT "attendance_day_branches_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
