-- Note text can stay on the attendance day without appearing on the report.
-- Existing rows stay visible. Rollback: ALTER TABLE attendance_day_notes DROP COLUMN show_on_report;

ALTER TABLE "attendance_day_notes"
  ADD COLUMN "show_on_report" BOOLEAN NOT NULL DEFAULT true;
