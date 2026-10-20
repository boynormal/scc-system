-- Announced holidays apply only to the branches listed here.
-- Rollback: DROP TABLE attendance_holiday_branches; DROP TABLE attendance_holidays;

CREATE TABLE "attendance_holidays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_holidays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id")
);

CREATE INDEX "attendance_holidays_company_id_start_date_idx" ON "attendance_holidays"("company_id", "start_date");

CREATE TABLE "attendance_holiday_branches" (
  "holiday_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  CONSTRAINT "attendance_holiday_branches_pkey" PRIMARY KEY ("holiday_id", "branch_id"),
  CONSTRAINT "attendance_holiday_branches_holiday_id_fkey" FOREIGN KEY ("holiday_id") REFERENCES "attendance_holidays"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_holiday_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE
);

CREATE INDEX "attendance_holiday_branches_branch_id_idx" ON "attendance_holiday_branches"("branch_id");
