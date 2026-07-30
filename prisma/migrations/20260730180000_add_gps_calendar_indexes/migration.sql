-- GPS / calendar lookup performance
CREATE INDEX IF NOT EXISTS "transport_vehicles_gps_device_id_idx" ON "transport_vehicles"("gps_device_id");
CREATE INDEX IF NOT EXISTS "transport_jobs_company_id_scheduled_date_idx" ON "transport_jobs"("company_id", "scheduled_date");
