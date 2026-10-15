-- PM checklist on the asset register. QR uses public_token, not the asset id.
-- Rollback: DROP TABLE "asset_pm_results"; DROP TABLE "asset_pm_rounds"; DROP TABLE "asset_pm_items"; DROP TABLE "asset_pm_plans";

CREATE TABLE "asset_pm_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "interval_days" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "public_token" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "asset_pm_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_pm_plans_asset_id_key" ON "asset_pm_plans"("asset_id");
CREATE UNIQUE INDEX "asset_pm_plans_public_token_key" ON "asset_pm_plans"("public_token");
CREATE INDEX "asset_pm_plans_company_id_idx" ON "asset_pm_plans"("company_id");

CREATE TABLE "asset_pm_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "sequence" SMALLINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "asset_pm_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_pm_items_plan_id_idx" ON "asset_pm_items"("plan_id");

CREATE TABLE "asset_pm_rounds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pm_rounds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_pm_rounds_plan_id_recorded_at_idx" ON "asset_pm_rounds"("plan_id", "recorded_at");

CREATE TABLE "asset_pm_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "round_id" UUID NOT NULL,
    "item_id" UUID,
    "sequence" SMALLINT NOT NULL,
    "item_name" VARCHAR(255) NOT NULL,
    "status" "CheckStatus" NOT NULL,
    "remark" TEXT,

    CONSTRAINT "asset_pm_results_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "asset_pm_results_round_id_idx" ON "asset_pm_results"("round_id");

ALTER TABLE "asset_pm_plans" ADD CONSTRAINT "asset_pm_plans_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_pm_plans" ADD CONSTRAINT "asset_pm_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_pm_items" ADD CONSTRAINT "asset_pm_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "asset_pm_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_pm_rounds" ADD CONSTRAINT "asset_pm_rounds_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "asset_pm_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_pm_results" ADD CONSTRAINT "asset_pm_results_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "asset_pm_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_pm_results" ADD CONSTRAINT "asset_pm_results_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "asset_pm_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
