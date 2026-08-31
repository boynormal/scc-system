-- People Phase 3-Org: branch-scoped Position master + optional Personnel.positionId.
-- Org hierarchy lives on positions.parent_id. departments.parent_id stays unused.
-- Rollback: ALTER TABLE "personnel" DROP CONSTRAINT "personnel_position_id_fkey"; DROP INDEX "personnel_position_id_idx"; ALTER TABLE "personnel" DROP COLUMN "position_id"; DROP TABLE "positions";

CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID NOT NULL,
    "department_id" UUID,
    "parent_id" UUID,
    "code" VARCHAR(20),
    "name" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "responsibilities" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "positions_branch_id_idx" ON "positions"("branch_id");
CREATE INDEX "positions_parent_id_idx" ON "positions"("parent_id");
CREATE INDEX "positions_department_id_idx" ON "positions"("department_id");

-- Code is optional. Postgres treats NULLs as distinct, so rows without a code are unconstrained.
CREATE UNIQUE INDEX "positions_branch_code_unique" ON "positions"("branch_id", "code");

ALTER TABLE "positions" ADD CONSTRAINT "positions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "positions" ADD CONSTRAINT "positions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "personnel" ADD COLUMN "position_id" UUID;

CREATE INDEX "personnel_position_id_idx" ON "personnel"("position_id");

ALTER TABLE "personnel" ADD CONSTRAINT "personnel_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
