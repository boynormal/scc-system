-- Fix schema drift documented in docs/architecture/db-blueprint.md 2.6:
-- scripts/add-pm-columns.sql previously added these columns out-of-band (not
-- tracked by Prisma), and they were apparently dropped/never applied on this
-- dev DB by an earlier `prisma db push` run (db push reconciles the DB to
-- match schema.prisma, so untracked columns are not preserved). Machine
-- create/update/detail code paths depended on them via raw SQL and broke at
-- runtime with "column pm_general does not exist". Now modeled properly in
-- schema.prisma so Prisma Client owns them like any other column — see
-- Machine.pmGeneral / Machine.pmMajor and modules/machines/application/machine-service.ts.

-- AlterTable
ALTER TABLE "machines" ADD COLUMN     "pm_general" TEXT,
ADD COLUMN     "pm_major" TEXT;
