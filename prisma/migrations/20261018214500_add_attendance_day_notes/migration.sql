-- One free-text note per person per work day, edited from the daily attendance manage dialog.
-- Rollback: DROP TABLE attendance_day_notes;

CREATE TABLE "attendance_day_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "note" VARCHAR(500) NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_day_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_day_notes_person_date_unique" ON "attendance_day_notes"("personnel_id", "work_date");
CREATE INDEX "attendance_day_notes_company_id_work_date_idx" ON "attendance_day_notes"("company_id", "work_date");

ALTER TABLE "attendance_day_notes" ADD CONSTRAINT "attendance_day_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_day_notes" ADD CONSTRAINT "attendance_day_notes_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_day_notes" ADD CONSTRAINT "attendance_day_notes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
