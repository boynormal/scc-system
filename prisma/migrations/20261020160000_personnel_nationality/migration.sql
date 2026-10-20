-- Nationality for workforce KPIs.
-- Rollback: ALTER TABLE personnel DROP COLUMN nationality; DROP TYPE "PersonnelNationality";

CREATE TYPE "PersonnelNationality" AS ENUM ('THAI', 'MYANMAR', 'OTHER');

ALTER TABLE "personnel" ADD COLUMN "nationality" "PersonnelNationality";
