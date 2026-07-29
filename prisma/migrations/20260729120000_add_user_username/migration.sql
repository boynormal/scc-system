-- Add users.username (login id), backfill from email local-part, then enforce NOT NULL + UNIQUE

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" VARCHAR(50);

-- Backfill: sanitize email local-part; append short id suffix on collision
UPDATE "users" u
SET "username" = sub.candidate
FROM (
  SELECT
    id,
    CASE
      WHEN base_name = '' THEN 'user_' || LEFT(REPLACE(id::text, '-', ''), 8)
      ELSE base_name
    END AS candidate
  FROM (
    SELECT
      id,
      LEFT(
        REGEXP_REPLACE(LOWER(SPLIT_PART(email, '@', 1)), '[^a-z0-9._]', '', 'g'),
        40
      ) AS base_name
    FROM "users"
    WHERE "username" IS NULL
  ) raw
) sub
WHERE u.id = sub.id
  AND u."username" IS NULL;

-- Resolve remaining collisions by appending _ + short id
UPDATE "users" u
SET "username" = LEFT(u."username", 40) || '_' || LEFT(REPLACE(u.id::text, '-', ''), 8)
WHERE u.id IN (
  SELECT id
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at, id) AS rn
    FROM "users"
    WHERE username IS NOT NULL
  ) ranked
  WHERE rn > 1
);

ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");
