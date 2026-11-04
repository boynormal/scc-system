-- Short spoken clips for asset PM checklist items. Bytes stay on the row.
-- Rollback: ALTER TABLE "asset_pm_items" DROP COLUMN "audio_content_type", DROP COLUMN "audio_bytes";
-- ALTER TABLE "asset_pm_template_items" DROP COLUMN "audio_content_type", DROP COLUMN "audio_bytes";

ALTER TABLE "asset_pm_template_items" ADD COLUMN "audio_bytes" BYTEA;
ALTER TABLE "asset_pm_template_items" ADD COLUMN "audio_content_type" VARCHAR(127);

ALTER TABLE "asset_pm_items" ADD COLUMN "audio_bytes" BYTEA;
ALTER TABLE "asset_pm_items" ADD COLUMN "audio_content_type" VARCHAR(127);
