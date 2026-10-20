-- Birth date, hire date, gender, and exit details for workforce KPIs.
-- Rollback: ALTER TABLE personnel DROP COLUMN birth_date, DROP COLUMN start_date, DROP COLUMN gender, DROP COLUMN end_date, DROP COLUMN exit_kind;
--            DROP TYPE "PersonnelGender"; DROP TYPE "PersonnelExitKind";

CREATE TYPE "PersonnelGender" AS ENUM ('MALE', 'FEMALE', 'UNSPECIFIED');
CREATE TYPE "PersonnelExitKind" AS ENUM ('VOLUNTARY', 'INVOLUNTARY');

ALTER TABLE "personnel" ADD COLUMN "birth_date" DATE;
ALTER TABLE "personnel" ADD COLUMN "start_date" DATE;
ALTER TABLE "personnel" ADD COLUMN "gender" "PersonnelGender";
ALTER TABLE "personnel" ADD COLUMN "end_date" DATE;
ALTER TABLE "personnel" ADD COLUMN "exit_kind" "PersonnelExitKind";
