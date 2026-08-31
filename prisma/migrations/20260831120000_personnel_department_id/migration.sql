-- People Phase 2: optional home department on personnel (Shared Department Master).
-- Rollback: ALTER TABLE "personnel" DROP CONSTRAINT "personnel_department_id_fkey"; DROP INDEX "personnel_department_id_idx"; ALTER TABLE "personnel" DROP COLUMN "department_id";

ALTER TABLE "personnel" ADD COLUMN "department_id" UUID;

CREATE INDEX "personnel_department_id_idx" ON "personnel"("department_id");

ALTER TABLE "personnel" ADD CONSTRAINT "personnel_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
