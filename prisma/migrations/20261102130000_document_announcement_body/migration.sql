-- Text announcements live on the version. A version may omit the file.
-- Rollback: ALTER TABLE doc_center_versions DROP COLUMN body;
-- then ALTER COLUMN stored_file_id SET NOT NULL after backfilling nulls.

ALTER TABLE "doc_center_versions" ALTER COLUMN "stored_file_id" DROP NOT NULL;
ALTER TABLE "doc_center_versions" ADD COLUMN "body" TEXT;
