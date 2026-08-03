-- Add wheels JSON and backfill from wheel_position + work_type
ALTER TABLE "transport_tire_logs" ADD COLUMN IF NOT EXISTS "wheels" JSONB;

UPDATE "transport_tire_logs"
SET "wheels" = jsonb_build_array(
  jsonb_build_object(
    'position', "wheel_position",
    'workType', "work_type"::text
  )
)
WHERE "wheels" IS NULL;

ALTER TABLE "transport_tire_logs" ALTER COLUMN "wheels" SET NOT NULL;

ALTER TABLE "transport_tire_logs" DROP COLUMN IF EXISTS "wheel_position";
ALTER TABLE "transport_tire_logs" DROP COLUMN IF EXISTS "work_type";
