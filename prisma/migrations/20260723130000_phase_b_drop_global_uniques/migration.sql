-- DB-Phase B: drop legacy global @unique constraints now that the Phase A
-- composite (tenant-scoped) unique constraints have been validated with zero
-- duplicates (see scripts/precheck-tenant-uniques.sql) and app code has been
-- updated to query within the same scope (see docs/architecture/db-blueprint.md
-- section 2.1 / 3 DB-Phase B).
--
-- Also closes a Phase A gap for transport_jobs.job_number, which never got a
-- composite unique: job numbers are generated per companyId (see
-- modules/transport/application/job-service.ts generateJobNumber), so the
-- global unique constraint could otherwise block two different companies from
-- both using their own "TJ-<year>-00001" — this migration adds the composite
-- unique and drops the global one in the same step.

-- DropIndex (legacy global unique constraints)
DROP INDEX "machines_code_key";

DROP INDEX "spare_parts_code_key";

DROP INDEX "suppliers_code_key";

DROP INDEX "transport_jobs_job_number_key";

-- users.email stays globally unique on purpose (login has no company selector).
-- The composite that used to coexist with it added no real constraint, so it is
-- dropped here as dead weight — see prisma/schema.prisma User model comment.
DROP INDEX "users_company_id_email_key";

DROP INDEX "users_employee_code_key";

DROP INDEX "work_orders_wo_number_key";

-- CreateIndex (plain btree indexes to keep search/lookup performance after
-- dropping the unique indexes above)
CREATE INDEX "spare_parts_code_idx" ON "spare_parts"("code");

CREATE INDEX "suppliers_code_idx" ON "suppliers"("code");

CREATE INDEX "transport_jobs_job_number_idx" ON "transport_jobs"("job_number");

-- CreateIndex (new Phase A/B composite unique for transport_jobs, closing the gap)
CREATE UNIQUE INDEX "transport_jobs_company_id_job_number_key" ON "transport_jobs"("company_id", "job_number");
