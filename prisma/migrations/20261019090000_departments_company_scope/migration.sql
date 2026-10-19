-- Departments belong to the company. Same trimmed name within a company becomes one row.
-- Rollback: not reversible after duplicate rows are merged.

ALTER TABLE "departments" ADD COLUMN "company_id" UUID;

UPDATE "departments" AS d
SET "company_id" = b."company_id"
FROM "branches" AS b
WHERE d."branch_id" = b."id";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "departments" WHERE "company_id" IS NULL) THEN
    RAISE EXCEPTION 'department is missing a company';
  END IF;
END $$;

UPDATE "departments"
SET "name" = btrim("name")
WHERE "name" <> btrim("name");

CREATE TEMP TABLE "department_merge" (
  "old_id" UUID PRIMARY KEY,
  "new_id" UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO "department_merge" ("old_id", "new_id")
SELECT ranked."id", survivor."id"
FROM (
  SELECT
    "id",
    "company_id",
    "name",
    row_number() OVER (PARTITION BY "company_id", "name" ORDER BY "created_at" ASC, "id" ASC) AS "rn"
  FROM "departments"
) AS ranked
JOIN (
  SELECT "id", "company_id", "name"
  FROM (
    SELECT
      "id",
      "company_id",
      "name",
      row_number() OVER (PARTITION BY "company_id", "name" ORDER BY "created_at" ASC, "id" ASC) AS "rn"
    FROM "departments"
  ) AS picked
  WHERE picked."rn" = 1
) AS survivor
  ON survivor."company_id" = ranked."company_id"
 AND survivor."name" = ranked."name"
WHERE ranked."rn" > 1;

UPDATE "departments" AS survivor
SET "code" = picked."code"
FROM (
  SELECT DISTINCT ON (merge."new_id") merge."new_id", donor."code"
  FROM "department_merge" AS merge
  JOIN "departments" AS donor ON donor."id" = merge."old_id"
  WHERE donor."code" IS NOT NULL AND btrim(donor."code") <> ''
  ORDER BY merge."new_id", donor."created_at" ASC
) AS picked
WHERE survivor."id" = picked."new_id"
  AND (survivor."code" IS NULL OR btrim(survivor."code") = '');

UPDATE "machines" AS machine
SET "department_id" = merge."new_id"
FROM "department_merge" AS merge
WHERE machine."department_id" = merge."old_id";

UPDATE "personnel" AS person
SET "department_id" = merge."new_id"
FROM "department_merge" AS merge
WHERE person."department_id" = merge."old_id";

UPDATE "departments" AS child
SET "parent_id" = merge."new_id"
FROM "department_merge" AS merge
WHERE child."parent_id" = merge."old_id";

UPDATE "departments"
SET "parent_id" = NULL
WHERE "parent_id" = "id";

DELETE FROM "departments" AS department
USING "department_merge" AS merge
WHERE department."id" = merge."old_id";

ALTER TABLE "departments" ALTER COLUMN "company_id" SET NOT NULL;

ALTER TABLE "departments" DROP CONSTRAINT "departments_branch_id_fkey";
DROP INDEX "departments_branch_id_idx";
ALTER TABLE "departments" DROP COLUMN "branch_id";

ALTER TABLE "departments"
  ADD CONSTRAINT "departments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "departments_company_id_idx" ON "departments"("company_id");
CREATE UNIQUE INDEX "departments_company_id_name_key" ON "departments"("company_id", "name");
