-- Pickup form catalog: three cargo types and the "ลูก" unit, per company.
-- Rollback: DELETE FROM "units" WHERE "code" = 'LUK';
-- DELETE FROM "transport_cargo_types" WHERE "name" IN ('แบตเตอรี่ใหญ่', 'แบตเตอรี่เล็ก', 'ตะกั่ว');

INSERT INTO "transport_cargo_types" ("id", "company_id", "name", "sort_order", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), company."id", cargo."name", cargo."sort_order", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" AS company
CROSS JOIN (
    VALUES
        ('แบตเตอรี่ใหญ่', 100),
        ('แบตเตอรี่เล็ก', 101),
        ('ตะกั่ว', 102)
) AS cargo("name", "sort_order")
WHERE NOT EXISTS (
    SELECT 1
    FROM "transport_cargo_types" AS existing
    WHERE existing."company_id" = company."id" AND existing."name" = cargo."name"
);

INSERT INTO "units" ("id", "company_id", "code", "name", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), company."id", 'LUK', 'ลูก', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" AS company
WHERE NOT EXISTS (
    SELECT 1 FROM "units" AS existing
    WHERE existing."company_id" = company."id" AND existing."code" = 'LUK'
);
