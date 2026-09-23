-- Job stop punches, optional driver login user, and live GPS snapshot on vehicles.
-- Rollback: DROP TABLE "job_stop_punches"; ALTER TABLE "drivers" DROP CONSTRAINT "drivers_user_id_fkey"; DROP INDEX "drivers_user_id_key"; ALTER TABLE "drivers" DROP COLUMN "user_id"; ALTER TABLE "transport_vehicles" DROP COLUMN "gps_latitude", DROP COLUMN "gps_longitude", DROP COLUMN "gps_odometer_km", DROP COLUMN "gps_read_at"; DROP TYPE "JobStopPunchKind";

CREATE TYPE "JobStopPunchKind" AS ENUM ('depart', 'arrive');

ALTER TABLE "transport_vehicles" ADD COLUMN "gps_latitude" DECIMAL(10,7);
ALTER TABLE "transport_vehicles" ADD COLUMN "gps_longitude" DECIMAL(10,7);
ALTER TABLE "transport_vehicles" ADD COLUMN "gps_odometer_km" DECIMAL(12,2);
ALTER TABLE "transport_vehicles" ADD COLUMN "gps_read_at" TIMESTAMPTZ;

ALTER TABLE "drivers" ADD COLUMN "user_id" UUID;
CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "job_stop_punches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "stop_id" UUID NOT NULL,
    "kind" "JobStopPunchKind" NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "gps_latitude" DECIMAL(10,7),
    "gps_longitude" DECIMAL(10,7),
    "odometer_km" DECIMAL(12,2),
    "gps_read_at" TIMESTAMPTZ,

    CONSTRAINT "job_stop_punches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_stop_punches_stop_id_kind_key" ON "job_stop_punches"("stop_id", "kind");
CREATE INDEX "job_stop_punches_job_id_idx" ON "job_stop_punches"("job_id");
CREATE INDEX "job_stop_punches_recorded_at_idx" ON "job_stop_punches"("recorded_at");

ALTER TABLE "job_stop_punches" ADD CONSTRAINT "job_stop_punches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "transport_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_stop_punches" ADD CONSTRAINT "job_stop_punches_stop_id_fkey" FOREIGN KEY ("stop_id") REFERENCES "job_stops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_stop_punches" ADD CONSTRAINT "job_stop_punches_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
