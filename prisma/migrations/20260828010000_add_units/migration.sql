-- Shared Unit master (company-scoped). Used by expense lines this phase;
-- spare_parts.unit remains a free-text string.

CREATE TABLE "units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "units_company_id_idx" ON "units"("company_id");
CREATE UNIQUE INDEX "units_company_id_code_key" ON "units"("company_id", "code");

ALTER TABLE "units" ADD CONSTRAINT "units_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default units for every existing company
INSERT INTO "units" ("id", "company_id", "code", "name", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), c."id", v."code", v."name", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
CROSS JOIN (
    VALUES
        ('PCS',  'ชิ้น'),
        ('L',    'ลิตร'),
        ('HOUR', 'ชั่วโมง'),
        ('TIME', 'ครั้ง'),
        ('KM',   'กิโลเมตร'),
        ('KG',   'กิโลกรัม'),
        ('TON',  'ตัน'),
        ('BOX',  'กล่อง'),
        ('SET',  'ชุด'),
        ('M',    'เมตร')
) AS v("code", "name");
