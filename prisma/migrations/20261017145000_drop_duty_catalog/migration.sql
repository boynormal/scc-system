-- Drop the duty catalog and the free-text duty columns.
-- Rollback: restore D:\project\backups\machine_maintenance_before_drop_duties_20261017_134234.dump
-- or re-apply prisma/migrations/20260925120000_duty_catalog/migration.sql
-- and recreate positions.responsibilities (see 20260831210000_add_positions).

ALTER TABLE "personnel_position_duty_items" DROP CONSTRAINT "personnel_position_duty_items_duty_item_id_fkey";
ALTER TABLE "personnel_position_duty_items" DROP CONSTRAINT "personnel_position_duty_items_personnel_position_id_fkey";
ALTER TABLE "position_duty_items" DROP CONSTRAINT "position_duty_items_duty_item_id_fkey";
ALTER TABLE "position_duty_items" DROP CONSTRAINT "position_duty_items_position_id_fkey";
ALTER TABLE "duty_items" DROP CONSTRAINT "duty_items_category_id_fkey";
ALTER TABLE "duty_categories" DROP CONSTRAINT "duty_categories_company_id_fkey";

ALTER TABLE "personnel_positions" DROP COLUMN "extra_duties";
ALTER TABLE "positions" DROP COLUMN "responsibilities";

DROP TABLE "personnel_position_duty_items";
DROP TABLE "position_duty_items";
DROP TABLE "duty_items";
DROP TABLE "duty_categories";
