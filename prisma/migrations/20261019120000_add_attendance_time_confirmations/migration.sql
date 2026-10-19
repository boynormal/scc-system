-- HR confirmed in/out for one person on one day. Sync never writes this table.
-- Rollback: DROP TABLE attendance_time_confirmations;

CREATE TABLE "attendance_time_confirmations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "personnel_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "confirmed_in" TIMESTAMPTZ NOT NULL,
    "confirmed_out" TIMESTAMPTZ NOT NULL,
    "source_first_in" TIMESTAMPTZ,
    "source_last_out" TIMESTAMPTZ,
    "decided_by_id" UUID NOT NULL,
    "decided_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "attendance_time_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attendance_time_confirmations_person_date_unique" ON "attendance_time_confirmations"("personnel_id", "work_date");
CREATE INDEX "attendance_time_confirmations_company_id_work_date_idx" ON "attendance_time_confirmations"("company_id", "work_date");

ALTER TABLE "attendance_time_confirmations" ADD CONSTRAINT "attendance_time_confirmations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_time_confirmations" ADD CONSTRAINT "attendance_time_confirmations_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_time_confirmations" ADD CONSTRAINT "attendance_time_confirmations_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
