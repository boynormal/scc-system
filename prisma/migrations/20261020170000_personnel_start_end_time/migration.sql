-- Start and exit times for personnel, stored in Bangkok wall time.
-- Rollback: ALTER TABLE personnel
--   ALTER COLUMN start_date TYPE DATE USING start_date AT TIME ZONE 'Asia/Bangkok',
--   ALTER COLUMN end_date TYPE DATE USING end_date AT TIME ZONE 'Asia/Bangkok';

ALTER TABLE "personnel"
  ALTER COLUMN "start_date" TYPE TIMESTAMPTZ
  USING CASE
    WHEN "start_date" IS NULL THEN NULL
    ELSE ("start_date"::timestamp AT TIME ZONE 'Asia/Bangkok')
  END;

ALTER TABLE "personnel"
  ALTER COLUMN "end_date" TYPE TIMESTAMPTZ
  USING CASE
    WHEN "end_date" IS NULL THEN NULL
    ELSE ("end_date"::timestamp AT TIME ZONE 'Asia/Bangkok')
  END;
