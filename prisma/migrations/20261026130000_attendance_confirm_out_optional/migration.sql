-- A confirmed clock-in can be saved before the clock-out exists.
-- Rollback: UPDATE attendance_time_confirmations SET confirmed_out = confirmed_in WHERE confirmed_out IS NULL;
--           ALTER TABLE attendance_time_confirmations ALTER COLUMN confirmed_out SET NOT NULL;

ALTER TABLE "attendance_time_confirmations" ALTER COLUMN "confirmed_out" DROP NOT NULL;
