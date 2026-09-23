-- Nullable stop for start/finish, one of each per job. Arrive and depart stay tied to a stop.
-- Rollback: DROP INDEX "job_stop_punches_one_finish_per_job"; DROP INDEX "job_stop_punches_one_start_per_job"; ALTER TABLE "job_stop_punches" DROP CONSTRAINT "job_stop_punches_bookend_stop_check"; UPDATE "job_stop_punches" SET "stop_id" = "stop_id" WHERE "stop_id" IS NOT NULL; ALTER TABLE "job_stop_punches" ALTER COLUMN "stop_id" SET NOT NULL;

ALTER TABLE "job_stop_punches" ALTER COLUMN "stop_id" DROP NOT NULL;

ALTER TABLE "job_stop_punches" ADD CONSTRAINT "job_stop_punches_bookend_stop_check" CHECK (
  ("kind" IN ('start', 'finish') AND "stop_id" IS NULL)
  OR
  ("kind" IN ('depart', 'arrive') AND "stop_id" IS NOT NULL)
);

CREATE UNIQUE INDEX "job_stop_punches_one_start_per_job" ON "job_stop_punches" ("job_id") WHERE "kind" = 'start';
CREATE UNIQUE INDEX "job_stop_punches_one_finish_per_job" ON "job_stop_punches" ("job_id") WHERE "kind" = 'finish';
