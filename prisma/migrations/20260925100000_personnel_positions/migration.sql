-- Several positions per person. Existing single positionId rows are copied in.
-- Rollback: DROP TABLE "personnel_positions";

CREATE TABLE "personnel_positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "personnel_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personnel_positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personnel_position_unique" ON "personnel_positions"("personnel_id", "position_id");
CREATE INDEX "personnel_positions_position_id_idx" ON "personnel_positions"("position_id");

ALTER TABLE "personnel_positions" ADD CONSTRAINT "personnel_positions_personnel_id_fkey" FOREIGN KEY ("personnel_id") REFERENCES "personnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personnel_positions" ADD CONSTRAINT "personnel_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "personnel_positions" ("personnel_id", "position_id")
SELECT "id", "position_id" FROM "personnel" WHERE "position_id" IS NOT NULL;
