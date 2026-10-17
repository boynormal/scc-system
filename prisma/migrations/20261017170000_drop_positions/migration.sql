-- Remove the org chart and position master. Position rows and seat assignments are deleted permanently.
-- Rollback is not possible from this migration; restore from a database backup taken before deploy.

DROP TABLE "personnel_positions";

ALTER TABLE "personnel" DROP CONSTRAINT "personnel_position_id_fkey";
DROP INDEX "personnel_position_id_idx";
ALTER TABLE "personnel" DROP COLUMN "position_id";

DROP TABLE "positions";
