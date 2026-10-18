-- Store a person's confirmation that a scan outside the company shift is OT or not.
-- Rollback: drop table attendance_ot_decisions, then drop types AttendanceOtDecisionKind and AttendanceOtSide.

CREATE TYPE "AttendanceOtSide" AS ENUM ('BEFORE', 'AFTER');
CREATE TYPE "AttendanceOtDecisionKind" AS ENUM ('OT', 'NOT_OT');

CREATE TABLE "attendance_ot_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "side" "AttendanceOtSide" NOT NULL,
    "punch_at" TIMESTAMPTZ NOT NULL,
    "decision" "AttendanceOtDecisionKind" NOT NULL,
    "ot_minutes" INTEGER NOT NULL,
    "decided_by_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_ot_decisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_ot_decisions_person_date_side_unique" ON "attendance_ot_decisions"("personnel_id", "work_date", "side");
CREATE INDEX "attendance_ot_decisions_company_id_work_date_idx" ON "attendance_ot_decisions"("company_id", "work_date");

ALTER TABLE "attendance_ot_decisions" ADD CONSTRAINT "attendance_ot_decisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_ot_decisions" ADD CONSTRAINT "attendance_ot_decisions_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_ot_decisions" ADD CONSTRAINT "attendance_ot_decisions_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
