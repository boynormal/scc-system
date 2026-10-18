-- Categorize a daily note so the manage menu can explain late arrival, lateness, or absence.
-- Rollback: ALTER TABLE attendance_day_notes DROP COLUMN reason;

ALTER TABLE "attendance_day_notes" ADD COLUMN "reason" VARCHAR(30);
