-- HR attendance redesign: replace the Excel-based attendance_entries / attendance_import_batches
-- with per-branch HIP PremiumTime sync (devices, badges, raw punches, daily summary).
-- Rollback: drop the five attendance_* tables + two enums below, then recreate the old tables
-- from the backup taken before this migration (pg_dump -Fc, restore with pg_restore -t).

-- CreateEnum
CREATE TYPE "AttendanceSourceType" AS ENUM ('HIP_PREMIUMTIME');

-- CreateEnum
CREATE TYPE "AttendanceDayStatus" AS ENUM ('COMPLETE', 'SINGLE_PUNCH');

-- DropForeignKey
ALTER TABLE "attendance_entries" DROP CONSTRAINT "attendance_entries_branch_id_fkey";
ALTER TABLE "attendance_entries" DROP CONSTRAINT "attendance_entries_company_id_fkey";
ALTER TABLE "attendance_entries" DROP CONSTRAINT "attendance_entries_import_batch_id_fkey";
ALTER TABLE "attendance_entries" DROP CONSTRAINT "attendance_entries_personnel_id_fkey";
ALTER TABLE "attendance_import_batches" DROP CONSTRAINT "attendance_import_batches_branch_id_fkey";
ALTER TABLE "attendance_import_batches" DROP CONSTRAINT "attendance_import_batches_company_id_fkey";
ALTER TABLE "attendance_import_batches" DROP CONSTRAINT "attendance_import_batches_created_by_id_fkey";

-- DropTable
DROP TABLE "attendance_entries";
DROP TABLE "attendance_import_batches";

-- CreateTable
CREATE TABLE "attendance_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "source_type" "AttendanceSourceType" NOT NULL DEFAULT 'HIP_PREMIUMTIME',
    "name" VARCHAR(100) NOT NULL,
    "machine_number" INTEGER,
    "api_key_prefix" VARCHAR(16),
    "api_key_hash" VARCHAR(64),
    "last_source_row_id" INTEGER NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMPTZ,
    "last_client_version" VARCHAR(30),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_badges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "badge_number" VARCHAR(30) NOT NULL,
    "name_on_device" VARCHAR(255),
    "personnel_id" UUID,
    "mapped_by_id" UUID,
    "mapped_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_badges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_sync_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "duplicates" INTEGER NOT NULL DEFAULT 0,
    "new_badges" INTEGER NOT NULL DEFAULT 0,
    "client_version" VARCHAR(30),
    "triggered_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_punches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "personnel_id" UUID,
    "punch_at" TIMESTAMPTZ NOT NULL,
    "check_type" VARCHAR(5),
    "verify_code" INTEGER,
    "source_row_id" INTEGER,
    "sync_run_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_days" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "first_in" TIMESTAMPTZ NOT NULL,
    "last_out" TIMESTAMPTZ,
    "punch_count" INTEGER NOT NULL,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceDayStatus" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_days_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_devices_api_key_prefix_key" ON "attendance_devices"("api_key_prefix");
CREATE INDEX "attendance_devices_company_id_idx" ON "attendance_devices"("company_id");
CREATE UNIQUE INDEX "attendance_devices_branch_name_unique" ON "attendance_devices"("branch_id", "name");
CREATE INDEX "attendance_badges_branch_id_personnel_id_idx" ON "attendance_badges"("branch_id", "personnel_id");
CREATE INDEX "attendance_badges_personnel_id_idx" ON "attendance_badges"("personnel_id");
CREATE UNIQUE INDEX "attendance_badges_device_number_unique" ON "attendance_badges"("device_id", "badge_number");
CREATE INDEX "attendance_sync_runs_device_id_created_at_idx" ON "attendance_sync_runs"("device_id", "created_at");
CREATE INDEX "attendance_punches_branch_id_punch_at_idx" ON "attendance_punches"("branch_id", "punch_at");
CREATE INDEX "attendance_punches_personnel_id_punch_at_idx" ON "attendance_punches"("personnel_id", "punch_at");
CREATE INDEX "attendance_punches_badge_id_idx" ON "attendance_punches"("badge_id");
CREATE UNIQUE INDEX "attendance_punches_device_badge_time_unique" ON "attendance_punches"("device_id", "badge_id", "punch_at");
CREATE INDEX "attendance_days_branch_id_work_date_idx" ON "attendance_days"("branch_id", "work_date");
CREATE INDEX "attendance_days_company_id_work_date_idx" ON "attendance_days"("company_id", "work_date");
CREATE UNIQUE INDEX "attendance_days_person_date_branch_unique" ON "attendance_days"("personnel_id", "work_date", "branch_id");

-- AddForeignKey
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_devices" ADD CONSTRAINT "attendance_devices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_badges" ADD CONSTRAINT "attendance_badges_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_badges" ADD CONSTRAINT "attendance_badges_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_badges" ADD CONSTRAINT "attendance_badges_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_badges" ADD CONSTRAINT "attendance_badges_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_badges" ADD CONSTRAINT "attendance_badges_mapped_by_id_fkey" FOREIGN KEY ("mapped_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_sync_runs" ADD CONSTRAINT "attendance_sync_runs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_sync_runs" ADD CONSTRAINT "attendance_sync_runs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "attendance_badges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_sync_run_id_fkey" FOREIGN KEY ("sync_run_id") REFERENCES "attendance_sync_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_days" ADD CONSTRAINT "attendance_days_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
