-- Human document codes for transport repair / tire logs.
-- Format: RP-YYYY-NNNNN / TY-YYYY-NNNNN. Issued at create; backfill existing by Bangkok year.

ALTER TABLE "transport_repair_logs" ADD COLUMN "repair_number" VARCHAR(30);

WITH numbered AS (
  SELECT
    id,
    'RP-' ||
      EXTRACT(YEAR FROM (reported_at AT TIME ZONE 'Asia/Bangkok'))::int ||
      '-' ||
      LPAD(
        (
          ROW_NUMBER() OVER (
            PARTITION BY company_id, EXTRACT(YEAR FROM (reported_at AT TIME ZONE 'Asia/Bangkok'))
            ORDER BY reported_at ASC, created_at ASC, id ASC
          )
        )::text,
        5,
        '0'
      ) AS repair_number
  FROM "transport_repair_logs"
)
UPDATE "transport_repair_logs" AS t
SET "repair_number" = n.repair_number
FROM numbered AS n
WHERE t.id = n.id;

ALTER TABLE "transport_repair_logs" ALTER COLUMN "repair_number" SET NOT NULL;

CREATE UNIQUE INDEX "transport_repair_logs_company_id_repair_number_key"
  ON "transport_repair_logs"("company_id", "repair_number");

ALTER TABLE "transport_tire_logs" ADD COLUMN "tire_number" VARCHAR(30);

WITH numbered AS (
  SELECT
    id,
    'TY-' ||
      EXTRACT(YEAR FROM (work_date AT TIME ZONE 'Asia/Bangkok'))::int ||
      '-' ||
      LPAD(
        (
          ROW_NUMBER() OVER (
            PARTITION BY company_id, EXTRACT(YEAR FROM (work_date AT TIME ZONE 'Asia/Bangkok'))
            ORDER BY work_date ASC, created_at ASC, id ASC
          )
        )::text,
        5,
        '0'
      ) AS tire_number
  FROM "transport_tire_logs"
)
UPDATE "transport_tire_logs" AS t
SET "tire_number" = n.tire_number
FROM numbered AS n
WHERE t.id = n.id;

ALTER TABLE "transport_tire_logs" ALTER COLUMN "tire_number" SET NOT NULL;

CREATE UNIQUE INDEX "transport_tire_logs_company_id_tire_number_key"
  ON "transport_tire_logs"("company_id", "tire_number");
